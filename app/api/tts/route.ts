/**
 * TTS（文字转语音）API 路由。
 *
 * 功能：接收前端文本，转发到 SiliconFlow 语音合成接口，
 * 并将上游音频流直接返回给前端播放。
 */
import { NextResponse } from 'next/server';

import {
  getSiliconFlowSettings,
  joinSiliconFlowUrl,
} from '@/lib/siliconflow-voice';

interface TtsRequestBody {
  text?: string;
  input?: string;
  content?: string;
  message?: string;
  model?: string;
  voice?: string;
  responseFormat?: string;
  sampleRate?: number;
  speed?: number;
  gain?: number;
}

async function readRequestBody(req: Request): Promise<TtsRequestBody> {
  // 兼容 JSON 和纯文本请求体，减少前端接入约束
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return (await req.json()) as TtsRequestBody;
  }

  const raw = await req.text();
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as TtsRequestBody;
  } catch {
    return { text: raw };
  }
}

function extractTtsText(body: TtsRequestBody): string {
  // 兼容多个常见文本字段命名
  return (body.text || body.input || body.content || body.message || '').trim();
}

export async function POST(req: Request) {
  try {
    // 1) 解析请求并提取可朗读文本
    const body = await readRequestBody(req);
    const text = extractTtsText(body);

    if (!text) {
      return NextResponse.json(
        {
          error: '朗读内容不能为空',
          details:
            '请求体缺少可用文本字段（text/input/content/message）或内容为空',
        },
        { status: 400 },
      );
    }

    // 2) 读取语音配置并转发到上游 TTS 接口
    const settings = getSiliconFlowSettings();
    const response = await fetch(
      joinSiliconFlowUrl(settings.baseUrl, '/audio/speech'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // 固定使用服务端配置的单一模型，忽略请求体中的 model
          model: settings.ttsModel,
          input: text,
          voice: body.voice || settings.ttsVoice,
          response_format: body.responseFormat || settings.ttsResponseFormat,
          sample_rate: body.sampleRate || settings.ttsSampleRate,
          speed: body.speed || settings.ttsSpeed,
          gain: body.gain || settings.ttsGain,
        }),
        signal: req.signal,
      },
    );

    if (!response.ok || !response.body) {
      // 上游失败时返回结构化错误
      const errorText = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'TTS 生成失败',
          details: errorText || `HTTP ${response.status}`,
        },
        { status: response.status || 500 },
      );
    }

    // 3) 透传音频流给前端
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    // 用户取消请求时返回 499，前端可视作正常中断
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }

    console.error('TTS Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'TTS 服务暂时不可用',
      },
      { status: 500 },
    );
  }
}
