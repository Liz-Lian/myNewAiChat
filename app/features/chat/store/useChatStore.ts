import { create } from 'zustand';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  sendMessage: async (content) => {
    // 1. 构造用户消息并更新状态
    const userMsg: Message = { role: 'user', content };
    const currentMessages = [...get().messages, userMsg];

    // 1. 先只显示用户消息，AI 的气泡等首个 token 到达后再创建
    set({
      messages: currentMessages,
      isLoading: true,
    });

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: currentMessages }),
    });

    if (!response.body) {
      set({ isLoading: false });
      return;
    }

    // 2. 解析流（核心逻辑）
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    // ai 回复是逐步流式返回的，我们需要一个累积器来拼接完整的回复内容
    let accumulatedContent = '';
    let hasStartedAssistant = false;
    // buffer 用来处理流式数据中可能出现的半行数据（SSE 按行发送）
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 的“行”处理；不完整的一行保留到下一次继续拼接
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          if (line === 'data: [DONE]') continue;

          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const data = JSON.parse(raw);
            let delta = data.choices?.[0]?.delta?.content || '';
            if (!delta) continue;

            // 部分模型会先输出 "\n\n" 作为首个 token，这里仅在首段时去掉前导换行。
            if (!accumulatedContent) {
              delta = delta.replace(/^\r?\n+/, '');
              if (!delta) continue;
            }

            accumulatedContent += delta;

            // 首个有效 token 到达时再创建 AI 气泡，同时隐藏 loading。
            if (!hasStartedAssistant) {
              hasStartedAssistant = true;
              set((state) => ({
                messages: [
                  ...state.messages,
                  { role: 'assistant', content: accumulatedContent },
                ],
                isLoading: false,
              }));
              continue;
            }

            // 3. 后续 token 只更新最后一条 AI 消息
            set((state) => ({
              messages: state.messages.map((msg, i) =>
                i === state.messages.length - 1
                  ? { ...msg, content: accumulatedContent }
                  : msg,
              ),
            }));
          } catch {
            // 这一行还不完整，等下一次 chunk 继续拼接
          }
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
