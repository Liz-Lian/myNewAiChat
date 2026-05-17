<!-- 本文件记录project-map相关的项目说明与协作指南。 -->

# 项目地图

本文件用于快速理解仓库结构和模块边界。处理具体任务时，再继续阅读更细的任务文档。

## 技术栈

- Next.js 16 App Router + React 19。
- TypeScript strict，`@/*` 指向仓库根目录。
- Tailwind CSS 4、shadcn/radix 风格组件、`next-themes`、`sonner`。
- Zustand 管理聊天状态。
- Prisma 7 + PostgreSQL，Prisma client 输出到 `app/generated/prisma`。
- JWT + HttpOnly Cookie 处理登录态。
- SiliconFlow 提供聊天、STT 和 TTS 能力。

## 顶层结构

- `app/`：页面、布局、API Route Handlers、feature-local 前端代码。
- `app/features/chat/`：聊天功能的组件、hooks、Zustand store。
- `components/`：跨功能 UI、布局、sidebar、header、theme provider。
- `components/ui/`：shadcn/radix 风格基础组件。
- `lib/`：共享工具，如 `cn()`、SSE 解析、SiliconFlow 配置。
- `server/`：服务端专用代码，包括 auth、db client、repositories。
- `prisma/`：schema、migrations、seed 入口。
- `.github/copilot-instructions.md`：给 Copilot 的高信号镜像说明。

## 当前主要用户流程

1. 用户登录：`POST /api/auth/login` 校验邮箱和密码，签发 JWT 并写入 `__Host-session`。
2. 聊天发送：前端 `useChatStore.sendMessage()` 调用 `POST /api/chat`。
3. 会话持久化：`/api/chat` 创建或校验 conversation，写入 user message。
4. 模型响应：`/api/chat` 以 SSE 方式转发 SiliconFlow `/chat/completions`。
5. 前端流式更新：`useChatStore` 解析 SSE delta，创建或更新最后一条 assistant message。
6. 响应落库：服务端流结束后写入 assistant message 并 touch conversation。
7. 语音：录音经 `/api/stt` 转文字；assistant 消息经 `/api/tts` 转音频播放。

## 关键边界

- 路由层负责鉴权、输入校验、响应格式和编排。
- `server/repositories/` 负责 Prisma 查询，特别是 userId 数据隔离。
- `lib/chat-sse.ts` 是 SSE 解析的共享核心，前后端都依赖它。
- `lib/siliconflow-voice.ts` 只集中语音相关配置；聊天模型目前在 `app/api/chat/route.ts` 内固定。
- `app/page.tsx` 当前仍使用静态会话列表数据，和后端 conversation API 尚未完全接入。

## 常见任务入口

- 改聊天界面：从 `app/page.tsx`、`components/layouts/chat-layout.tsx`、`app/features/chat/components/` 开始。
- 改聊天状态：从 `app/features/chat/store/useChatStore.ts` 开始。
- 改聊天 API：从 `app/api/chat/route.ts`、`lib/chat-sse.ts`、repositories 开始。
- 改登录态：从 `server/auth/` 和 `app/api/auth/*` 开始。
- 改数据模型：从 `prisma/schema.prisma`、`server/repositories/`、相关 API route 开始。
