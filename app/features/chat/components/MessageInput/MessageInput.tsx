/**
 * message-input.tsx
 * 消息输入组件
 * 提供文本输入框和发送按钮，支持Enter键发送消息。
 * 禁用状态下无法输入和发送（如正在加载响应时）。
 */

import { useState } from 'react';
import { RotateCcw, Send, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  onRetry: () => Promise<void>;
  disabled?: boolean;
  error?: string | null;
}

export function MessageInput({
  onSend,
  onStop,
  onRetry,
  disabled,
  error,
}: MessageInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const isRetryVisible = Boolean(error);

  return (
    <div className="border-t bg-white px-6 py-4">
      {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
      <div className="flex gap-2">
        <Input
          placeholder="输入消息... (按 Enter 发送)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={disabled}
          className="flex-1"
        />
        {disabled ? (
          <Button onClick={onStop} variant="outline" className="gap-2">
            <Square className="h-4 w-4" />
            停止
          </Button>
        ) : null}
        {isRetryVisible ? (
          <Button
            onClick={() => void onRetry()}
            variant="outline"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            重试
          </Button>
        ) : null}
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
