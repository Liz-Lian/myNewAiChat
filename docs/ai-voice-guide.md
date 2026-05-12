# AI、SSE 和语音指南

处理聊天模型、流式响应、SiliconFlow、语音识别或语音合成时阅读本文件。

## 聊天接口

- `app/api/chat/route.ts` 使用当前登录用户保存的 `siliconflowApiKey` 调用 SiliconFlow。
- 聊天模型来自 `SILICONFLOW_CHAT_MODEL`，缺省为 `Qwen/Qwen3-8B`。
- base URL 使用 `SILICONFLOW_BASE_URL`，缺省为 `https://api.siliconflow.cn/v1`。
- 请求体包含 `{ model, messages, stream: true }`。
- 服务端会保存最新 user message；流结束后如果 assistant 内容非空，再保存 assistant message。

## SSE 解析

- `lib/chat-sse.ts` 负责拆行、识别 `data: ` payload、忽略 `[DONE]`、抽取 `choices[0].delta.content`。
- `consumeSseStream()` 支持 `onChunk` 透传原始 chunk，也支持 `onDelta` 收集文本。
- 服务端用 `onChunk` 把上游原始 SSE 透传给前端。
- 前端用同一解析器更新 UI；修改上游格式适配时要保证两端都还能工作。

## STT

- 前端入口：`app/features/chat/hooks/useVoiceRecorder.ts`。
- 后端入口：`app/api/stt/route.ts`。
- 前端使用 `MediaRecorder` 录音，上传 FormData 字段 `file`。
- 后端转发到 `/audio/transcriptions`，模型来自 `SILICONFLOW_STT_MODEL` 或默认值。
- 后端兼容 `text`、`transcription`、`data.text` 三种返回结构。

## TTS

- 前端入口：`app/features/chat/hooks/useSpeechPlayback.ts`。
- 后端入口：`app/api/tts/route.ts`。
- TTS 文本字段兼容 `text`、`input`、`content`、`message`。
- 后端转发到 `/audio/speech`，音频流直接返回给前端。
- 前端用 Blob -> ObjectURL -> `Audio` 播放，并在结束或切换时回收资源。

## 环境变量

- 聊天：用户级 SiliconFlow API Key 保存在数据库 `User.siliconflowApiKey`。
- 语音：服务端读取 `SILICONFLOW_API_KEY`。
- 通用：`SILICONFLOW_BASE_URL`。
- 聊天模型：`SILICONFLOW_CHAT_MODEL`。
- STT：`SILICONFLOW_STT_MODEL`。
- TTS：`SILICONFLOW_TTS_VOICE`、`SILICONFLOW_TTS_RESPONSE_FORMAT`、`SILICONFLOW_TTS_SAMPLE_RATE`、`SILICONFLOW_TTS_SPEED`、`SILICONFLOW_TTS_GAIN`。

## 改动注意

- 不要把用户 API Key 或服务端 API Key 返回给前端。
- 流式聊天中断不一定是错误，前后端都已有取消路径。
- 改 `consumeSseStream()` 要小心 partial chunks 和未完整 JSON 行。
- 改 TTS 播放时要继续释放 ObjectURL，避免内存泄漏。

## 验证建议

- 聊天：验证新会话、已有会话、无 API Key、上游失败、用户停止生成。
- STT：验证不支持录音的浏览器降级、拒绝麦克风权限、上游识别失败。
- TTS：验证空文本、上游失败、暂停、继续、停止、切换朗读消息。
