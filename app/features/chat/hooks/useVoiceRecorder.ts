/**
 * 语音录制与转写 Hook（STT 前端入口）。
 *
 * 功能：管理浏览器录音状态、麦克风权限、音频上传与识别结果回填。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceRecorderOptions {
  onTranscript: (transcript: string) => void;
}

// 录音状态机：idle -> recording -> processing -> idle
type RecorderStatus = 'idle' | 'recording' | 'processing' | 'unsupported';

// 用户是否拒绝权限
function isPermissionError(error: unknown) {
  // 兼容不同浏览器的权限拒绝错误名
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
  );
}
// 根据 MIME 类型推断录音文件扩展名，便于后端识别和处理
function guessRecordingExtension(mimeType: string) {
  // 根据 mimeType 推断文件扩展名，便于后端识别
  if (mimeType.includes('mp4')) {
    return 'm4a';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  return 'webm';
}

export function useVoiceRecorder({ onTranscript }: UseVoiceRecorderOptions) {
  // 当前录音器实例（开始/停止录音时使用）
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // 当前麦克风流（用于在结束时关闭所有音轨）
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // 录音分片缓存，onstop 后会合并为一个完整 Blob
  const chunksRef = useRef<BlobPart[]>([]);
  // 录音状态机：idle -> recording -> processing -> idle
  const [status, setStatus] = useState<RecorderStatus>('unsupported');
  // 面向 UI 的错误提示文案
  const [error, setError] = useState<string | null>(null);
  // 浏览器是否支持录音能力（getUserMedia + MediaRecorder）
  const [isSupported, setIsSupported] = useState(false);

  const releaseStream = useCallback(() => {
    // 统一释放媒体资源，避免麦克风被占用
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);
  // 上传录音后进入 processing 状态，并把后端识别出的文本回填给输入框。
  const uploadRecording = useCallback(
    async (blob: Blob) => {
      // 录音结束后进入处理态并上传到后端 STT 路由
      setStatus('processing');

      try {
        // 将录音文件和必要参数封装为 FormData，便于后端接收和处理
        const formData = new FormData();
        formData.append(
          'file',
          blob,
          `recording-${Date.now()}.${guessRecordingExtension(blob.type)}`,
        );

        const response = await fetch('/api/stt', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          // 后端返回结构化错误时优先展示可读错误文案
          const payload = (await response.json().catch(() => null)) as {
            error?: unknown;
            details?: unknown;
          } | null;

          const message =
            typeof payload?.error === 'string'
              ? payload.error
              : typeof payload?.details === 'string'
                ? payload.details
                : '语音识别失败';

          throw new Error(message);
        }

        const payload = (await response.json()) as { text?: unknown };
        const transcript =
          typeof payload.text === 'string' ? payload.text.trim() : '';

        if (!transcript) {
          throw new Error('语音识别结果为空');
        }

        onTranscript(transcript);
        setStatus(isSupported ? 'idle' : 'unsupported');
      } catch (uploadError) {
        console.error('Voice transcription failed:', uploadError);
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : '语音识别失败，请重试',
        );
        setStatus(isSupported ? 'idle' : 'unsupported');
      } finally {
        // 无论成功失败都释放录音资源
        releaseStream();
      }
    },
    [isSupported, onTranscript, releaseStream],
  );
  // 开始录音时申请麦克风权限、选择可用编码格式，并注册录音事件。
  const startRecording = useCallback(async () => {
    setError(null);

    if (!isSupported) {
      setError('当前浏览器不支持录音');
      setStatus('unsupported');
      return;
    }

    if (status === 'recording' || status === 'processing') {
      return;
    }

    try {
      // 1) 申请麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 2) 选择浏览器支持的最佳录音格式
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        // 持续收集录音分片
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('录音过程中发生错误');
        setStatus('idle');
        releaseStream();
      };

      recorder.onstop = () => {
        // 停止后拼接 Blob，并触发上传识别
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        chunksRef.current = [];

        void uploadRecording(blob);
      };

      recorder.start();
      setStatus('recording');
    } catch (recordingError) {
      console.error('Start recording failed:', recordingError);
      setError(
        isPermissionError(recordingError)
          ? '麦克风权限被拒绝，请允许访问后重试'
          : '无法开始录音，请检查麦克风',
      );
      setStatus(isSupported ? 'idle' : 'unsupported');
      releaseStream();
    }
  }, [isSupported, releaseStream, status, uploadRecording]);
  // 停止录音会触发 recorder.onstop，在那里合并音频并上传识别。
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state !== 'recording') {
      return;
    }

    recorder.stop();
  }, []);
  // 清理错误状态，便于用户重试
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  // 组件卸载时清理资源，避免麦克风被占用或内存泄漏
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';

    setIsSupported(supported);
    setStatus(supported ? 'idle' : 'unsupported');

    return () => {
      releaseStream();
    };
  }, [releaseStream]);

  return {
    clearError,
    error,
    isProcessing: status === 'processing',
    isRecording: status === 'recording',
    isSupported,
    startRecording,
    stopRecording,
    status,
  };
}
