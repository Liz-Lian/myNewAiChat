'use client';

/**
 * message-input.tsx
 * 消息输入组件
 * 提供文本输入框和发送按钮，支持Enter键发送消息。
 * 禁用状态下无法输入和发送（如正在加载响应时）。
 */

import { useState } from 'react';
import { Loader2, Mic, MicOff, RotateCcw, Send, Square } from 'lucide-react';

import { useVoiceRecorder } from '@/app/features/chat/hooks/useVoiceRecorder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

  const recorder = useVoiceRecorder({
    onTranscript: (transcript) => {
      setInput(transcript);
    },
  });

  const handleSend = () => {
    if (input.trim() && !disabled && !recorder.isProcessing) {
      onSend(input);
      setInput('');
    }
  };

  const handleToggleRecording = () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
      return;
    }

    void recorder.startRecording();
  };

  const isRetryVisible = Boolean(error || recorder.error);
  const combinedError = error || recorder.error;
  const micDisabled =
    disabled || recorder.isProcessing || !recorder.isSupported;

  return (
    <div className="border-t bg-white px-6 py-4">
      {combinedError ? (
        <p className="mb-3 text-sm text-red-500">{combinedError}</p>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className={cn(recorder.isRecording && 'text-rose-500')}>
          {recorder.isRecording
            ? '录音中，点击停止后自动识别'
            : recorder.isProcessing
              ? '正在识别语音...'
              : recorder.isSupported
                ? '支持 Chrome / Edge 录音输入'
                : '当前设备暂不支持录音，建议使用 Chrome / Edge'}
        </span>
        {!recorder.isSupported ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
            已降级
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="输入消息... (按 Enter 发送)"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            recorder.clearError();
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={disabled || recorder.isProcessing}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleToggleRecording}
          disabled={micDisabled}
          variant={recorder.isRecording ? 'destructive' : 'outline'}
          className="gap-2"
          title={
            recorder.isSupported ? '开始或停止录音' : '当前浏览器不支持录音'
          }
        >
          {recorder.isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : recorder.isRecording ? (
            <Square className="h-4 w-4" />
          ) : recorder.isSupported ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
          {recorder.isRecording
            ? '停止录音'
            : recorder.isProcessing
              ? '识别中'
              : '开始录音'}
        </Button>
        {disabled ? (
          <Button
            type="button"
            onClick={onStop}
            variant="outline"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            停止
          </Button>
        ) : null}
        {isRetryVisible ? (
          <Button
            type="button"
            onClick={() => {
              recorder.clearError();
              void onRetry();
            }}
            variant="outline"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            重试
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={handleSend}
          disabled={disabled || recorder.isProcessing || !input.trim()}
          className="gap-2 bg-blue-500 hover:bg-blue-600"
        >
          <Send className="h-4 w-4" />
          发送
        </Button>
      </div>
    </div>
  );
}
