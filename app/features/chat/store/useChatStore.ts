import { create } from 'zustand';

import { consumeSseStream } from '@/lib/chat-sse';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type ChatStreamReader = ReadableStreamDefaultReader<Uint8Array>;

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  // 是否正在生成AI回复（即已发送用户消息，正在等待或接收AI回复）
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  // 当前活跃的请求ID，用于区分不同的请求，确保状态更新只影响当前请求
  currentRequestId: number | null;
  // 当前请求的AbortController，用于取消请求
  currentController: AbortController | null;
  // 当前请求的流读取器，用于取消流读取
  currentReader: ChatStreamReader | null;
  sendMessage: (content: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  stopGeneration: () => void;
  clearConversation: () => void;
}
// 请求序列号，用于生成唯一的请求ID，确保每次发送消息都会有一个新的请求ID
let requestSequence = 0;

export const useChatStore = create<ChatState>((set, get) => {
  // 清理“当前请求状态”（不清消息）
  const clearActiveRequest = () => {
    set({
      isGenerating: false,
      isLoading: false,
      currentRequestId: null,
      currentController: null,
      currentReader: null,
    });
  };
  // 清理“整段会话状态”（会清消息）
  const resetAllState = () => {
    set({
      messages: [],
      conversationId: null,
      isGenerating: false,
      isLoading: false,
      error: null,
      currentRequestId: null,
      currentController: null,
      currentReader: null,
    });
  };
  // 中断请求 + 取消流读取 + 清理当前请求状态
  const stopCurrentRequest = () => {
    const { currentController, currentReader } = get();

    currentController?.abort();
    void currentReader?.cancel().catch((error) => {
      console.warn('Failed to cancel current reader:', error);
    });
    clearActiveRequest();
  };
  // 判断请求是否还是“当前有效请求”
  const isCurrentRequest = (requestId: number) =>
    get().currentRequestId === requestId;
  // 求结束统一收尾（释放 reader 锁 + 清理当前请求状态）
  const finalizeRequest = (requestId: number) => {
    if (!isCurrentRequest(requestId)) {
      return;
    }

    const { currentReader } = get();
    if (currentReader) {
      try {
        currentReader.releaseLock();
      } catch (error) {
        console.warn('Failed to release reader lock:', error);
      }
    }

    clearActiveRequest();
  };
  // 真正发请求、读流、拼接助手消息、处理错误
  const sendChatRequest = async (
    messages: Message[],
    conversationId: string | null,
    requestId: number,
    controller: AbortController,
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, conversationId }),
        signal: controller.signal,
      });

      if (!isCurrentRequest(requestId)) {
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch((error) => {
          console.warn('Failed to parse error response:', error);
          return null;
        })) as {
          error?: unknown;
        } | null;
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : '消息发送失败，请重试';

        set({
          error: message,
          isGenerating: false,
          isLoading: false,
          currentRequestId: null,
          currentController: null,
          currentReader: null,
        });
        return;
      }

      if (!response.body) {
        set({
          error: '未收到流式响应',
          isGenerating: false,
          isLoading: false,
          currentRequestId: null,
          currentController: null,
          currentReader: null,
        });
        return;
      }

      const reader = response.body.getReader();
      const responseConversationId = response.headers.get('x-conversation-id');
      if (!isCurrentRequest(requestId)) {
        await reader.cancel().catch((error) => {
          console.warn('Failed to cancel stale reader:', error);
        });
        return;
      }

      set({
        currentReader: reader,
        conversationId: responseConversationId || conversationId,
      });

      let accumulatedContent = '';
      let hasStartedAssistant = false;

      const consumeStatus = await consumeSseStream({
        reader,
        shouldStop: () => !isCurrentRequest(requestId),
        onDelta: (rawDelta) => {
          if (!isCurrentRequest(requestId)) {
            return;
          }

          let delta = rawDelta;
          if (!accumulatedContent) {
            delta = delta.replace(/^\r?\n+/, '');
            if (!delta) {
              return;
            }
          }

          accumulatedContent += delta;

          if (!hasStartedAssistant) {
            hasStartedAssistant = true;
            const assistantMessage: Message = {
              role: 'assistant',
              content: accumulatedContent,
            };

            set((state) => ({
              messages: [...state.messages, assistantMessage],
            }));
            return;
          }

          set((state) => {
            const nextMessages = [...state.messages];
            nextMessages[nextMessages.length - 1] = {
              ...nextMessages[nextMessages.length - 1],
              content: accumulatedContent,
            };

            return { messages: nextMessages };
          });
        },
      });

      if (consumeStatus === 'stopped') {
        await reader.cancel().catch((error) => {
          console.warn('Failed to cancel stale reader:', error);
        });
        return;
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      if (!isCurrentRequest(requestId)) {
        return;
      }

      set({
        error: error instanceof Error ? error.message : '消息发送失败，请重试',
        isGenerating: false,
        isLoading: false,
        currentRequestId: null,
        currentController: null,
        currentReader: null,
      });
      return;
    } finally {
      finalizeRequest(requestId);
    }
  };

  return {
    messages: [],
    conversationId: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    currentRequestId: null,
    currentController: null,
    currentReader: null,
    stopGeneration: () => {
      stopCurrentRequest();
      set({ error: null });
    },
    // 删掉末尾 assistant 后重发最后一条 user
    clearConversation: () => {
      stopCurrentRequest();
      requestSequence += 1;
      resetAllState();
    },
    retryLastMessage: async () => {
      const { messages, isGenerating } = get();

      if (isGenerating) {
        return;
      }

      const nextMessages = [...messages];
      if (nextMessages.at(-1)?.role === 'assistant') {
        nextMessages.pop();
      }

      if (nextMessages.at(-1)?.role !== 'user') {
        set({ error: '没有可重试的消息' });
        return;
      }

      const controller = new AbortController();
      const requestId = ++requestSequence;

      set({
        messages: nextMessages,
        isGenerating: true,
        isLoading: true,
        error: null,
        currentRequestId: requestId,
        currentController: controller,
        currentReader: null,
      });

      await sendChatRequest(
        nextMessages,
        get().conversationId,
        requestId,
        controller,
      );
    },
    sendMessage: async (content) => {
      const trimmedContent = content.trim();
      if (!trimmedContent || get().isGenerating) {
        return;
      }

      const controller = new AbortController();
      const requestId = ++requestSequence;
      const userMessage: Message = {
        role: 'user',
        content: trimmedContent,
      };
      const nextMessages: Message[] = [...get().messages, userMessage];
      const currentConversationId = get().conversationId;

      set({
        messages: nextMessages,
        isGenerating: true,
        isLoading: true,
        error: null,
        currentRequestId: requestId,
        currentController: controller,
        currentReader: null,
      });

      await sendChatRequest(
        nextMessages,
        currentConversationId,
        requestId,
        controller,
      );
    },
  };
});
