<!-- 本文件记录api-guide相关的项目说明与协作指南。 -->

# API 指南

处理 `app/api/*`、服务端请求、错误响应和外部 API 调用时阅读本文件。

## Route Handler 总览

- `app/api/chat/route.ts`：聊天主接口，鉴权、校验消息、创建或校验 conversation、转发 SiliconFlow SSE、落库 assistant 响应。
- `app/api/auth/login/route.ts`：邮箱密码登录，签发 session cookie。
- `app/api/auth/logout/route.ts`：清除 session cookie。
- `app/api/auth/me/route.ts`：读取当前登录用户。
- `app/api/conversations/route.ts`：列出和创建当前用户会话。
- `app/api/conversations/[conversationId]/route.ts`：读取、更新标题、删除当前用户会话。
- `app/api/user/siliconflow-key/route.ts`：更新当前用户保存的 SiliconFlow API Key。
- `app/api/stt/route.ts`：上传音频转发到 SiliconFlow STT。
- `app/api/tts/route.ts`：文本转发到 SiliconFlow TTS，并透传音频流。

## 路由层职责

- 先鉴权，再做资源级权限检查。
- 用 `zod` 校验 JSON payload；不能假设请求体存在或合法。
- 使用 `createJsonError()` 和 `createUnauthorizedResponse()` 返回结构化错误。
- 成功响应通常带 `Cache-Control: no-store`，避免用户数据被缓存。
- 外部 API 调用必须检查 `response.ok`，并处理缺失 `response.body`。
- 用户主动取消请求时，现有代码倾向返回 `499`。

## 数据访问边界

- 路由层优先调用 `server/repositories/*`，不要把 Prisma 查询散落在 route 文件里。
- 涉及用户资源时，查询条件必须携带 `userId`。
- 更新或删除会话时，使用 `findOwned*`、`updateTitleOwned`、`deleteOwned` 这类语义化 repository 方法。

## SSE 聊天流

- `/api/chat` 返回 `Content-Type: text/event-stream; charset=utf-8`。
- 服务端会先 enqueue 一段包含 `conversationId` 的 SSE data。
- `consumeSseStream()` 同时用于服务端抽取 assistant 内容和前端解析 delta。
- 修改 SSE 格式时要同步检查 `lib/chat-sse.ts` 和 `useChatStore.ts`。

## API 任务验证

- 单个 route 改动可先运行 `npx eslint app/api/<route>/route.ts`。
- 涉及 shared server 模块或类型时运行 `npx tsc --noEmit`。
- 改聊天流、TTS、STT 时，尽量本地手动验证成功、上游失败、取消请求这三种路径。
