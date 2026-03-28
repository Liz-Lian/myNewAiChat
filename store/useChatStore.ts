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
    const userMsg: Message = { role: 'user', content };
    const currentMessages = [...get().messages, userMsg];

    // 1. 先把用户消息显示出来，并占位一个空的 assistant 消息
    set({
      messages: [...currentMessages, { role: 'assistant', content: '' }],
      isLoading: true,
    });

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: currentMessages }),
    });

    if (!response.body) return;

    // 2. 解析流（核心逻辑）
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // 硅基流动返回的是标准的 SSE 格式：data: {"choices": [...]}
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices[0].delta.content || '';
            accumulatedContent += delta;

            // 3. 实时更新 Zustand 中的最后一条消息
            set((state) => ({
              messages: state.messages.map((msg, i) =>
                i === state.messages.length - 1
                  ? { ...msg, content: accumulatedContent }
                  : msg,
              ),
            }));
          } catch (e) {
            // 忽略部分不完整的 JSON 片段
          }
        }
      }
    }
    set({ isLoading: false });
  },
}));
