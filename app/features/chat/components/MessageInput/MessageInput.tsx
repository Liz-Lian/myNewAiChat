/**
 * message-input.tsx
 * 消息输入组件
 * 提供文本输入框和发送按钮，支持Enter键发送消息。
 * 禁用状态下无法输入和发送（如正在加载响应时）。
 */

import { useState } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  // 管理输入框的文本内容
  const [input, setInput] = useState('');

  // 处理发送消息：验证内容、调用回调、清空输入框
  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="border-t bg-white px-6 py-4">
      <div className="flex gap-2">
        {/* 消息输入框：Shift+Enter换行，Enter发送 */}
        <Input
          placeholder="输入消息... (按 Enter 发送)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={disabled}
          className="flex-1"
        />
        {/* 发送按钮：内容为空或禁用状态下不可点击 */}
        <Button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="gap-2 bg-blue-500 hover:bg-blue-600"
        >
          <Send className="h-4 w-4" />
          发送
        </Button>
      </div>
    </div>
  );
}
