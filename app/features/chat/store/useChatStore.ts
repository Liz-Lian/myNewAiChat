import { create } from 'zustand';

import {
  ChatMessage,
  ConversationSummary,
  continueConversationGeneration,
  fetchConversationDetail,
  fetchConversations,
  removeConversation,
  renameConversation,
} from '@/app/features/chat/services/conversationService';
import { consumeSseStream } from '@/lib/chat-sse';

type Message = ChatMessage;

type ChatStreamReader = ReadableStreamDefaultReader<Uint8Array>;
type StreamingPhase =
  | 'idle'
  | 'sending'
  | 'receiving'
  | 'continuing'
  | 'retrying'
  | 'editing';

type RegenerationRequest =
  | {
      type: 'retry';
      messageId: string;
    }
  | {
      type: 'edit';
      messageId: string;
    };

const isPersistableMessage = (message: Message) =>
  Boolean(message.content.trim());

interface ChatState {
  messages: Message[];
  currentConversationId: string | null;
  conversationId: string | null;
  conversations: ConversationSummary[];
  filteredConversations: ConversationSummary[];
  conversationSearchQuery: string;
  conversationsLoading: boolean;
  /** 是否正在生成 AI 回复，即已发送用户消息且正在等待或接收回复。 */
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  /** 当前活跃的请求 ID，用于确保状态更新只影响最新请求。 */
  currentRequestId: number | null;
  /** 当前请求的 AbortController，用于取消请求。 */
  currentController: AbortController | null;
  /** 当前请求的流读取器，用于取消流读取。 */
  currentReader: ChatStreamReader | null;
  streamingMessageId: string | null;
  streamingPhase: StreamingPhase;
  loadConversations: (options?: { silent?: boolean }) => Promise<void>;
  createNewConversation: () => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  setFilteredConversations: (conversations: ConversationSummary[]) => void;
  setConversationSearchQuery: (query: string) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
  sendMessage: (content: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  continueGeneration: (messageId: string) => Promise<void>;
  appendContent: (messageId: string, content: string) => void;
  stopGeneration: () => void;
  clearConversation: () => void;
}

/**
 * 请求序列号，用于生成唯一请求 ID。
 */
let requestSequence = 0;

export const useChatStore = create<ChatState>((set, get) => {
  /**
   * 将后端消息转换为前端可渲染消息。
   *
   * @param messages 后端返回的消息列表。
   * @returns 前端消息列表。
   */
  const normalizeMessages = (messages: Message[]): Message[] =>
    messages
      .filter((message) => ['user', 'assistant'].includes(message.role))
      .map((message) => ({
        ...message,
        role: message.role,
        content: message.content,
        isComplete:
          message.role === 'assistant'
            ? (message.isComplete ?? true)
            : undefined,
      }));

  /**
   * 根据当前搜索词过滤会话列表。
   *
   * @param conversations 原始会话列表。
   * @param query 搜索词。
   * @returns 过滤后的会话列表。
   */
  const filterConversations = (
    conversations: ConversationSummary[],
    query: string,
  ) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(keyword),
    );
  };

  /**
   * 清理当前请求状态，但保留已展示的消息和会话 ID。
   */
  const clearActiveRequest = () => {
    set({
      isGenerating: false,
      isLoading: false,
      currentRequestId: null,
      currentController: null,
      currentReader: null,
      streamingMessageId: null,
      streamingPhase: 'idle',
    });
  };
  /**
   * 清理整段会话状态，包括消息、会话 ID、错误和请求控制对象。
   */
  const resetAllState = () => {
    set({
      messages: [],
      currentConversationId: null,
      conversationId: null,
      isGenerating: false,
      isLoading: false,
      error: null,
      currentRequestId: null,
      currentController: null,
      currentReader: null,
      streamingMessageId: null,
      streamingPhase: 'idle',
    });
  };
  /**
   * 中断当前聊天请求并取消正在读取的流。
   */
  const stopCurrentRequest = () => {
    const { currentController, currentReader } = get();

    currentController?.abort();
    void currentReader?.cancel().catch((error) => {
      console.warn('Failed to cancel current reader:', error);
    });
    clearActiveRequest();
  };
  /**
   * 判断指定请求是否仍是当前有效请求。
   *
   * @param requestId 待检查的请求 ID。
   * @returns 请求仍然有效时返回 `true`。
   */
  const isCurrentRequest = (requestId: number) =>
    get().currentRequestId === requestId;

  /**
   * 在请求结束时统一释放流锁并清理请求状态。
   *
   * @param requestId 需要收尾的请求 ID。
   */
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
  /**
   * 发送聊天请求、消费 SSE 响应并逐步更新 assistant 消息。
   *
   * @param messages 本次发送给后端的完整上下文消息。
   * @param conversationId 当前会话 ID，首次发送时为 `null`。
   * @param requestId 本次请求的唯一 ID。
   * @param controller 本次请求使用的中断控制器。
   */
  const sendChatRequest = async (
    messages: Message[],
    conversationId: string | null,
    requestId: number,
    controller: AbortController,
    phase: StreamingPhase,
    targetAssistantMessageId?: string,
    regeneration?: RegenerationRequest,
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.filter(isPersistableMessage),
          ...(conversationId ? { conversationId } : {}),
          ...(regeneration ? { regeneration } : {}),
        }),
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
          details?: unknown;
        } | null;
        const message =
          typeof payload?.details === 'string'
            ? payload.details
            : typeof payload?.error === 'string'
              ? payload.error
              : '消息发送失败，请重试';

        set({
          error: message,
          isGenerating: false,
          isLoading: false,
          currentRequestId: null,
          currentController: null,
          currentReader: null,
          streamingMessageId: null,
          streamingPhase: 'idle',
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
          streamingMessageId: null,
          streamingPhase: 'idle',
        });
        return;
      }

      const reader = response.body.getReader();
      const responseConversationId = response.headers.get('x-conversation-id');
      const responseMessageId =
        response.headers.get('x-message-id') || targetAssistantMessageId;
      const responseUserMessageId = response.headers.get('x-user-message-id');
      if (!isCurrentRequest(requestId)) {
        await reader.cancel().catch((error) => {
          console.warn('Failed to cancel stale reader:', error);
        });
        return;
      }

      set({
        currentReader: reader,
        currentConversationId: responseConversationId || conversationId,
        conversationId: responseConversationId || conversationId,
        streamingMessageId: responseMessageId || null,
        streamingPhase: phase === 'sending' ? 'receiving' : phase,
      });

      if (responseUserMessageId) {
        set((state) => {
          const nextMessages = [...state.messages];
          const lastUserIndex = nextMessages.findLastIndex(
            (message) => message.role === 'user' && !message.id,
          );

          if (lastUserIndex < 0) {
            return state;
          }

          nextMessages[lastUserIndex] = {
            ...nextMessages[lastUserIndex],
            id: responseUserMessageId,
            ...(responseConversationId || conversationId
              ? {
                  conversationId:
                    responseConversationId || conversationId || undefined,
                }
              : {}),
          };

          return { messages: nextMessages };
        });
      }

      let accumulatedContent = '';
      let hasStartedAssistant = Boolean(responseMessageId);

      if (responseMessageId) {
        set((state) => {
          const hasAssistantPlaceholder = state.messages.some(
            (message) => message.id === responseMessageId,
          );

          if (hasAssistantPlaceholder) {
            return state;
          }

          return {
            messages: [
              ...state.messages,
              {
                id: responseMessageId,
                ...(responseConversationId || conversationId
                  ? {
                      conversationId:
                        responseConversationId || conversationId || undefined,
                    }
                  : {}),
                role: 'assistant',
                content: '',
                isComplete: false,
              },
            ],
          };
        });
      }

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
              ...(responseMessageId ? { id: responseMessageId } : {}),
              ...(responseConversationId || conversationId
                ? {
                    conversationId:
                      responseConversationId || conversationId || undefined,
                  }
                : {}),
              role: 'assistant',
              content: accumulatedContent,
              isComplete: false,
            };

            set((state) => ({
              messages: [...state.messages, assistantMessage],
            }));
            return;
          }

          set((state) => {
            const nextMessages = [...state.messages];
            const assistantIndex = responseMessageId
              ? nextMessages.findIndex(
                  (message) => message.id === responseMessageId,
                )
              : nextMessages.length - 1;

            if (assistantIndex < 0) {
              return state;
            }

            nextMessages[assistantIndex] = {
              ...nextMessages[assistantIndex],
              ...(responseMessageId ? { id: responseMessageId } : {}),
              content: accumulatedContent,
              isComplete: false,
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

      if (responseConversationId || conversationId) {
        if (responseMessageId) {
          set((state) => ({
            messages: state.messages.map((message) =>
              message.id === responseMessageId
                ? { ...message, isComplete: true }
                : message,
            ),
          }));
        }

        await get().loadConversations({ silent: true });
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
        streamingMessageId: null,
        streamingPhase: 'idle',
      });
      return;
    } finally {
      finalizeRequest(requestId);
    }
  };

  return {
    messages: [],
    currentConversationId: null,
    conversationId: null,
    conversations: [],
    filteredConversations: [],
    conversationSearchQuery: '',
    conversationsLoading: false,
    isGenerating: false,
    isLoading: false,
    error: null,
    currentRequestId: null,
    currentController: null,
    currentReader: null,
    streamingMessageId: null,
    streamingPhase: 'idle',
    /**
     * 停止当前 AI 回复生成，并清空当前错误提示。
     */
    stopGeneration: () => {
      const { streamingMessageId } = get();
      stopCurrentRequest();
      set((state) => ({
        error: null,
        messages: streamingMessageId
          ? state.messages.map((message) =>
              message.id === streamingMessageId
                ? { ...message, isComplete: false }
                : message,
            )
          : state.messages,
      }));
    },
    /**
     * 加载当前用户的所有会话。
     */
    loadConversations: async (options) => {
      if (options?.silent) {
        set({ error: null });
      } else {
        set({ conversationsLoading: true, error: null });
      }

      try {
        const conversations = await fetchConversations();
        set((state) => ({
          conversations,
          filteredConversations: filterConversations(
            conversations,
            state.conversationSearchQuery,
          ),
          conversationsLoading: false,
        }));
      } catch (error) {
        set({
          conversationsLoading: false,
          error: error instanceof Error ? error.message : '获取会话列表失败',
        });
      }
    },
    setFilteredConversations: (conversations) => {
      set({ filteredConversations: conversations });
    },
    setConversationSearchQuery: (query) => {
      set((state) => ({
        conversationSearchQuery: query,
        filteredConversations: filterConversations(state.conversations, query),
      }));
    },
    /**
     * 开启一个本地空白对话草稿。
     */
    createNewConversation: async () => {
      stopCurrentRequest();
      requestSequence += 1;
      set({
        messages: [],
        currentConversationId: null,
        conversationId: null,
        error: null,
      });
    },
    /**
     * 切换到指定会话并加载消息。
     *
     * @param id 会话 ID。
     */
    switchConversation: async (id) => {
      if (get().currentConversationId === id) {
        return;
      }

      stopCurrentRequest();
      requestSequence += 1;
      set({
        currentConversationId: id,
        conversationId: id,
        messages: [],
        isLoading: true,
        error: null,
      });

      try {
        const conversation = await fetchConversationDetail(id);
        set((state) => ({
          messages: normalizeMessages(conversation.messages),
          isLoading: false,
          conversations: state.conversations.map((item) =>
            item.id === conversation.id
              ? {
                  id: conversation.id,
                  title: conversation.title,
                  isShared: conversation.isShared,
                  sharedAt: conversation.sharedAt,
                  createdAt: conversation.createdAt,
                  updatedAt: conversation.updatedAt,
                }
              : item,
          ),
          filteredConversations: filterConversations(
            state.conversations.map((item) =>
              item.id === conversation.id
                ? {
                    id: conversation.id,
                    title: conversation.title,
                    isShared: conversation.isShared,
                    sharedAt: conversation.sharedAt,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                  }
                : item,
            ),
            state.conversationSearchQuery,
          ),
        }));
      } catch (error) {
        set({
          messages: [],
          isLoading: false,
          error: error instanceof Error ? error.message : '获取会话失败',
        });
      }
    },
    /**
     * 删除指定会话。
     *
     * @param id 会话 ID。
     */
    deleteConversation: async (id) => {
      stopCurrentRequest();

      try {
        await removeConversation(id);
        set((state) => {
          const conversations = state.conversations.filter(
            (item) => item.id !== id,
          );
          const isCurrent = state.currentConversationId === id;

          return {
            conversations,
            filteredConversations: filterConversations(
              conversations,
              state.conversationSearchQuery,
            ),
            messages: isCurrent ? [] : state.messages,
            currentConversationId: isCurrent
              ? null
              : state.currentConversationId,
            conversationId: isCurrent ? null : state.conversationId,
            error: null,
          };
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : '删除会话失败',
        });
      }
    },
    /**
     * 更新指定会话标题。
     *
     * @param id 会话 ID。
     * @param title 新标题。
     */
    updateConversationTitle: async (id, title) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        set({ error: '标题不能为空' });
        return;
      }

      try {
        const conversation = await renameConversation(id, trimmedTitle);
        set((state) => ({
          conversations: state.conversations.map((item) =>
            item.id === id ? { ...item, ...conversation } : item,
          ),
          filteredConversations: filterConversations(
            state.conversations.map((item) =>
              item.id === id ? { ...item, ...conversation } : item,
            ),
            state.conversationSearchQuery,
          ),
          error: null,
        }));
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : '重命名会话失败',
        });
      }
    },
    /**
     * 直接替换当前消息列表。
     *
     * @param messages 新消息列表。
     */
    setMessages: (messages) => {
      set({ messages: normalizeMessages(messages) });
    },
    /**
     * 清空当前消息列表。
     */
    clearMessages: () => {
      set({ messages: [] });
    },
    /**
     * 清空当前会话，并取消正在进行的生成。
     */
    clearConversation: () => {
      stopCurrentRequest();
      requestSequence += 1;
      resetAllState();
    },
    /**
     * 删除末尾 assistant 消息后，重新发送最后一条 user 消息。
     */
    retryLastMessage: async () => {
      const { messages, isGenerating } = get();

      if (isGenerating) {
        return;
      }

      const nextMessages = [...messages];
      const lastMessage = nextMessages.at(-1);
      let retryMessageId: string | undefined;
      if (lastMessage?.role === 'assistant') {
        retryMessageId = lastMessage.id;
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
        streamingMessageId: null,
        streamingPhase: 'retrying',
      });

      await sendChatRequest(
        nextMessages,
        get().currentConversationId,
        requestId,
        controller,
        'retrying',
        undefined,
        retryMessageId
          ? {
              type: 'retry',
              messageId: retryMessageId,
            }
          : undefined,
      );
    },
    retryMessage: async (messageId) => {
      const { messages, isGenerating } = get();

      if (isGenerating) {
        return;
      }

      const messageIndex = messages.findIndex(
        (message) => message.id === messageId,
      );
      if (messageIndex < 0 || messages[messageIndex]?.role !== 'assistant') {
        set({ error: '没有可重试的消息' });
        return;
      }

      const previousMessages = messages.slice(0, messageIndex);
      if (previousMessages.at(-1)?.role !== 'user') {
        set({ error: '没有可重试的用户消息' });
        return;
      }

      const controller = new AbortController();
      const requestId = ++requestSequence;

      set({
        messages: previousMessages,
        isGenerating: true,
        isLoading: true,
        error: null,
        currentRequestId: requestId,
        currentController: controller,
        currentReader: null,
        streamingMessageId: messageId,
        streamingPhase: 'retrying',
      });

      await sendChatRequest(
        previousMessages,
        get().currentConversationId,
        requestId,
        controller,
        'retrying',
        undefined,
        {
          type: 'retry',
          messageId,
        },
      );
    },
    editAndResend: async (messageId, newContent) => {
      const trimmedContent = newContent.trim();
      const { messages, isGenerating } = get();

      if (!trimmedContent || isGenerating) {
        return;
      }

      const messageIndex = messages.findIndex(
        (message) => message.id === messageId,
      );
      if (messageIndex < 0 || messages[messageIndex]?.role !== 'user') {
        set({ error: '没有可编辑的用户消息' });
        return;
      }

      const nextMessages = messages
        .slice(0, messageIndex + 1)
        .map((message, index) =>
          index === messageIndex
            ? { ...message, content: trimmedContent }
            : message,
        );
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
        streamingMessageId: messageId,
        streamingPhase: 'editing',
      });

      await sendChatRequest(
        nextMessages,
        get().currentConversationId,
        requestId,
        controller,
        'editing',
        undefined,
        {
          type: 'edit',
          messageId,
        },
      );
    },
    appendContent: (messageId, content) => {
      if (!content) {
        return;
      }

      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === messageId
            ? { ...message, content: `${message.content}${content}` }
            : message,
        ),
      }));
    },
    continueGeneration: async (messageId) => {
      const { currentConversationId, messages, isGenerating } = get();

      if (isGenerating) {
        return;
      }

      if (!currentConversationId) {
        set({ error: '当前会话无法继续生成' });
        return;
      }

      const targetMessage = messages.find(
        (message) => message.id === messageId,
      );
      if (!targetMessage || targetMessage.role !== 'assistant') {
        set({ error: '没有可继续生成的助手消息' });
        return;
      }

      const controller = new AbortController();
      const requestId = ++requestSequence;

      set({
        isGenerating: true,
        isLoading: true,
        error: null,
        currentRequestId: requestId,
        currentController: controller,
        currentReader: null,
        streamingMessageId: messageId,
        streamingPhase: 'continuing',
      });

      try {
        const response = await continueConversationGeneration(
          currentConversationId,
          messageId,
          controller.signal,
        );

        if (!isCurrentRequest(requestId)) {
          return;
        }

        if (!response.body) {
          set({ error: '未收到续传响应' });
          return;
        }

        const reader = response.body.getReader();
        set({ currentReader: reader });

        const consumeStatus = await consumeSseStream({
          reader,
          shouldStop: () => !isCurrentRequest(requestId),
          onDelta: (delta) => {
            get().appendContent(messageId, delta);
          },
        });

        if (consumeStatus === 'stopped') {
          await reader.cancel().catch((error) => {
            console.warn('Failed to cancel continue reader:', error);
          });
          return;
        }

        await get().loadConversations({ silent: true });
      } catch (error) {
        if (!controller.signal.aborted && isCurrentRequest(requestId)) {
          set({
            error: error instanceof Error ? error.message : '继续生成失败',
          });
        }
      } finally {
        finalizeRequest(requestId);
      }
    },
    /**
     * 发送新的用户消息，并启动对应的流式聊天请求。
     *
     * @param content 用户输入的原始消息内容。
     */
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
      const currentConversationId = get().currentConversationId;

      set({
        messages: nextMessages,
        isGenerating: true,
        isLoading: true,
        error: null,
        currentRequestId: requestId,
        currentController: controller,
        currentReader: null,
        streamingMessageId: null,
        streamingPhase: 'sending',
      });

      await sendChatRequest(
        nextMessages,
        currentConversationId,
        requestId,
        controller,
        'sending',
      );
    },
  };
});
