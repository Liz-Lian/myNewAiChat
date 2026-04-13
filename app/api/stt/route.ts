/**
 * STT（语音转文字）API 路由。
 *
 * 功能：接收前端上传的录音文件，转发到 SiliconFlow 语音识别接口，
 * 并把识别结果统一整理为 { text } 返回给前端。
 */
import { NextResponse } from 'next/server';

import {
  getSiliconFlowSettings,
  joinSiliconFlowUrl,
} from '@/lib/siliconflow-voice';

export async function POST(req: Request) {
  try {
    // 1) 读取前端上传的录音文件
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请上传录音文件' }, { status: 400 });
    }

    // 2) 读取服务端语音配置，并组装转发请求体
    const settings = getSiliconFlowSettings();
    const forwardFormData = new FormData();
    forwardFormData.append('file', file, file.name || 'recording.webm');
    forwardFormData.append('model', settings.sttModel);

    // 3) 调用上游 STT 接口（支持请求中断）
    const response = await fetch(
      joinSiliconFlowUrl(settings.baseUrl, '/audio/transcriptions'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: forwardFormData,
        signal: req.signal,
      },
    );

    if (!response.ok) {
      // 上游失败时透出可读错误，便于前端展示和排查
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: '语音识别失败',
          details: errorText || `HTTP ${response.status}`,
        },
        { status: response.status || 500 },
      );
    }

    // 4) 兼容不同字段结构，提取首个有效文本
    const payload = (await response.json()) as {
      text?: unknown;
      transcription?: unknown;
      data?: { text?: unknown };
    };

    const textCandidates = [
      payload.text,
      payload.transcription,
      payload.data?.text,
    ];
    const text = textCandidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    if (!text) {
      return NextResponse.json({ error: '语音识别结果为空' }, { status: 422 });
    }

    // 5) 统一返回给前端
    return NextResponse.json({ text });
  } catch (error) {
    // 用户主动中断不视为系统错误
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }

    console.error('STT Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '语音识别服务暂时不可用',
      },
      { status: 500 },
    );
  }
}
