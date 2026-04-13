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
    <div className="border-border/50 bg-background/75 border-t px-4 py-4 backdrop-blur-xl md:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        {combinedError ? (
          <p className="border-destructive/20 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
            {combinedError}
          </p>
        ) : null}
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
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
            <span className="border-border bg-card text-muted-foreground rounded-full border px-2 py-1 text-[11px]">
              已降级
            </span>
          ) : null}
        </div>
        <div className="border-border/70 bg-card/90 flex flex-col gap-2 rounded-[1.5rem] border p-3 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:flex-row sm:items-center">
          <Input
            placeholder="输入消息... (按 Enter 发送)"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              recorder.clearError();
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={disabled || recorder.isProcessing}
            className="border-border/70 bg-background/70 h-11 flex-1 rounded-2xl px-4 text-sm shadow-none"
          />
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              onClick={handleToggleRecording}
              disabled={micDisabled}
              variant={recorder.isRecording ? 'destructive' : 'outline'}
              className="gap-2 rounded-2xl"
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
                className="gap-2 rounded-2xl"
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
                className="gap-2 rounded-2xl"
              >
                <RotateCcw className="h-4 w-4" />
                重试
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleSend}
              disabled={disabled || recorder.isProcessing || !input.trim()}
              className="bg-primary text-primary-foreground shadow-primary/15 hover:bg-primary/90 gap-2 rounded-2xl shadow-lg"
            >
              <Send className="h-4 w-4" />
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
