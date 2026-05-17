/**
 * 语音播放 Hook（TTS 前端入口）。
 *
 * 功能：请求后端生成音频并播放，管理播放状态、暂停恢复与资源清理。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'error';

interface PlaySpeechOptions {
  key: string;
  text: string;
}

export function useSpeechPlayback() {
  // audioRef 保存当前 Audio 实例，切换消息播放时先清理旧资源。
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [status, setStatus] = useState<SpeechPlaybackStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const cleanupAudio = useCallback((shouldResetState: boolean) => {
    // 统一清理 audio 实例与 ObjectURL，避免内存泄漏
    const audio = audioRef.current;

    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.onplay = null;
      audio.pause();
      audio.currentTime = 0;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    audioRef.current = null;

    if (shouldResetState) {
      setActiveKey(null);
      setStatus('idle');
    }
  }, []);

  const stop = useCallback(() => {
    cleanupAudio(true);
  }, [cleanupAudio]);

  const pause = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || status !== 'playing') {
      return;
    }

    audio.pause();
    setStatus('paused');
  }, [status]);

  const playSpeech = useCallback(
    async ({ key, text }: PlaySpeechOptions) => {
      // 空文本不请求 TTS，直接把错误显示在消息列表顶部。
      const trimmedText = text.trim();
      if (!trimmedText) {
        setError('朗读内容不能为空');
        return;
      }

      // 同一条消息处于暂停态时复用现有 Audio，不重新请求后端音频。
      if (activeKey === key && status === 'paused' && audioRef.current) {
        setError(null);
        await audioRef.current.play().catch((playError) => {
          console.error('Resume audio playback failed:', playError);
          setError('朗读播放失败');
          setStatus('error');
        });
        return;
      }

      // 切换新内容时先清理旧播放器
      cleanupAudio(true);
      setActiveKey(key);
      setStatus('loading');
      setError(null);

      try {
        // 请求后端 TTS 路由生成音频
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: trimmedText,
            input: trimmedText,
            content: trimmedText,
          }),
        });

        if (!response.ok) {
          // 优先使用后端返回的结构化错误
          const payload = (await response.json().catch(() => null)) as {
            error?: unknown;
            details?: unknown;
          } | null;

          const message =
            typeof payload?.details === 'string' && payload.details.trim()
              ? `${payload.error || '朗读生成失败'}：${payload.details}`
              : typeof payload?.error === 'string'
                ? payload.error
                : '朗读生成失败';

          throw new Error(message);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error('朗读音频为空');
        }

        // Blob -> ObjectURL -> Audio 播放
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        const audio = new Audio(objectUrl);
        audioRef.current = audio;
        audio.onended = () => {
          // 播放完成后回收资源并重置状态
          cleanupAudio(true);
        };
        audio.onerror = () => {
          setError('朗读播放失败');
          setStatus('error');
          cleanupAudio(false);
        };
        audio.onpause = () => {
          if (audio.currentTime > 0 && !audio.ended) {
            setStatus('paused');
          }
        };
        audio.onplay = () => {
          setStatus('playing');
        };

        await audio.play();
        setStatus('playing');
      } catch (playError) {
        console.error('Speech playback failed:', playError);
        setError(
          playError instanceof Error ? playError.message : '朗读播放失败',
        );
        setStatus('error');
        cleanupAudio(true);
      }
    },
    [activeKey, cleanupAudio, status],
  );

  useEffect(() => {
    // 组件卸载时确保清理播放资源
    return () => {
      cleanupAudio(true);
    };
  }, [cleanupAudio]);

  return {
    activeKey,
    error,
    pause,
    playSpeech,
    status,
    stop,
  };
}
