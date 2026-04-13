/**
 * SiliconFlow 语音能力配置工具。
 *
 * 功能：集中管理 STT/TTS 默认参数、环境变量读取与 URL 拼接，
 * 供后端语音路由复用。
 */
export const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';
export const DEFAULT_SILICONFLOW_TTS_MODEL = 'FunAudioLLM/CosyVoice2-0.5B';
export const DEFAULT_SILICONFLOW_STT_MODEL = 'FunAudioLLM/SenseVoiceSmall';
export const DEFAULT_SILICONFLOW_TTS_RESPONSE_FORMAT = 'mp3';
export const DEFAULT_SILICONFLOW_TTS_SAMPLE_RATE = 44100;

export interface SiliconFlowSettings {
  apiKey: string;
  baseUrl: string;
  ttsModel: string;
  sttModel: string;
  ttsVoice: string;
  // 输出音频格式（如 mp3/wav/ogg），由上游 TTS 接口支持的格式决定
  ttsResponseFormat: string;
  // 输出音频采样率，单位 Hz，常见值有 22050、44100 等，采样率越高音质越好但文件也越大
  ttsSampleRate: number;
  // 语速，默认为 1，值越大语速越快，值越小语速越慢
  ttsSpeed: number;
  // 音量增益，默认为 1，值越大音量越大，值越小音量越小
  ttsGain: number;
}

function getDefaultTtsVoice(): string {
  // 当前项目固定使用 CosyVoice，默认音色统一为 alex
  return 'FunAudioLLM/CosyVoice2-0.5B:alex';
}

function normalizeTtsVoice(model: string, voice?: string): string {
  // voice 未设置或为 default 时，按模型兜底默认音色
  const trimmedVoice = voice?.trim();

  if (!trimmedVoice || trimmedVoice === 'default') {
    return getDefaultTtsVoice();
  }

  return trimmedVoice;
}

export function getSiliconFlowSettings(): SiliconFlowSettings {
  // 统一从环境变量读取语音配置，避免路由层重复逻辑
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('缺少 SILICONFLOW_API_KEY');
  }

  // 当前仅启用单一 TTS 模型，避免模型切换带来的音色不兼容问题
  const ttsModel = DEFAULT_SILICONFLOW_TTS_MODEL;
  const ttsResponseFormat =
    process.env.SILICONFLOW_TTS_RESPONSE_FORMAT?.trim() ||
    DEFAULT_SILICONFLOW_TTS_RESPONSE_FORMAT;
  const ttsSampleRate = Number(
    process.env.SILICONFLOW_TTS_SAMPLE_RATE ||
      DEFAULT_SILICONFLOW_TTS_SAMPLE_RATE,
  );

  return {
    apiKey,
    baseUrl:
      process.env.SILICONFLOW_BASE_URL?.trim() || DEFAULT_SILICONFLOW_BASE_URL,
    ttsModel,
    sttModel:
      process.env.SILICONFLOW_STT_MODEL?.trim() ||
      DEFAULT_SILICONFLOW_STT_MODEL,
    ttsVoice: normalizeTtsVoice(ttsModel, process.env.SILICONFLOW_TTS_VOICE),
    ttsResponseFormat,
    ttsSampleRate,
    ttsSpeed: Number(process.env.SILICONFLOW_TTS_SPEED || '1'),
    ttsGain: Number(process.env.SILICONFLOW_TTS_GAIN || '1'),
  };
}

export function joinSiliconFlowUrl(baseUrl: string, path: string): string {
  // 消除首尾多余斜杠，避免出现双斜杠 URL
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');

  return `${normalizedBaseUrl}/${normalizedPath}`;
}
