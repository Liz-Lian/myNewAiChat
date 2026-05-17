<!-- 本文件介绍项目用途、开发方式和基础使用说明。 -->

# My AI Chat

一个基于 Next.js App Router 的 AI 聊天应用，支持登录态、会话持久化、流式回复、会话分享、语音识别和语音朗读。模型、STT、TTS 能力由 SiliconFlow 提供，数据使用 PostgreSQL + Prisma 保存。

## 功能特性

- 邮箱密码登录，使用 `__Host-session` HttpOnly Cookie 保存会话。
- 多会话聊天，支持新建、切换、重命名、删除和搜索会话。
- AI 回复通过 SSE 流式输出，前端逐块更新 assistant 消息。
- 支持停止生成、重试消息、编辑后重发，以及服务端任务级继续生成。
- 会话内容落库保存，并按用户隔离访问权限。
- 支持生成公开分享链接，分享页无需登录即可只读查看。
- 支持语音输入（STT）和 assistant 回复朗读（TTS）。
- 支持 Markdown、GFM、代码高亮和消息复制。
- 支持亮色 / 暗色主题切换。

## 技术栈

- Next.js 16 App Router + React 19
- TypeScript strict
- Tailwind CSS 4 + shadcn/radix 风格组件
- Zustand
- Prisma 7 + PostgreSQL
- JWT + HttpOnly Cookie
- SiliconFlow Chat / STT / TTS
- ESLint 9 + Prettier

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

如果你想沿用仓库现有的 `package-lock.json`，也可以使用：

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env.local
```

Windows PowerShell 可以使用：

```powershell
Copy-Item .env.example .env.local
```

按需填写以下变量：

```bash
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/chatdb"
AUTH_JWT_SECRET="请替换为足够长的随机字符串"

SILICONFLOW_API_KEY="用于 STT/TTS 的服务端 API Key"
SILICONFLOW_BASE_URL="https://api.siliconflow.cn/v1"
SILICONFLOW_CHAT_MODEL="Qwen/Qwen3-8B"
SILICONFLOW_TTS_MODEL="FunAudioLLM/CosyVoice2-0.5B"
SILICONFLOW_STT_MODEL="FunAudioLLM/SenseVoiceSmall"

SILICONFLOW_TTS_VOICE="default"
SILICONFLOW_TTS_RESPONSE_FORMAT="mp3"
SILICONFLOW_TTS_SAMPLE_RATE="24000"
SILICONFLOW_TTS_SPEED="1"
SILICONFLOW_TTS_GAIN="1"
```

聊天接口优先使用当前用户保存的 SiliconFlow API Key；语音接口读取服务端环境变量 `SILICONFLOW_API_KEY`。

### 3. 启动数据库

仓库提供了 PostgreSQL 的 Docker Compose 配置：

```bash
docker compose up -d
```

默认数据库连接信息：

- 用户名：`myuser`
- 密码：`mypassword`
- 数据库：`chatdb`
- 端口：`5432`

### 4. 初始化数据库

```bash
npm run db:init
```

该命令会执行 Prisma schema 同步、生成 Prisma client，并写入 seed 用户。默认登录账号：

- 邮箱：`admin@local.dev`
- 密码：`Admin@123456`

可以通过以下变量覆盖 seed 用户：

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_NAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_SILICONFLOW_API_KEY`

### 5. 启动开发服务

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 访问应用。

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run start        # 运行生产构建
npm run lint         # 运行 ESLint
npm run db:generate  # 生成 Prisma client
npm run db:push      # 同步 schema 到数据库
npm run db:migrate   # 创建并应用迁移
npm run db:seed      # 执行 seed
npm run db:studio    # 打开 Prisma Studio
```

也可以使用等价的 `prisma:*` 脚本，例如 `npm run prisma:generate`。

## 项目结构

```text
app/
  api/                  # Route Handlers
  features/auth/        # 登录弹窗与认证 hook
  features/chat/        # 聊天组件、hooks、service、Zustand store
  generated/prisma/     # Prisma 生成产物
  share/[shareToken]/   # 公开分享页
components/
  header/               # 顶部栏
  layouts/              # 页面布局
  sidebar/              # 会话侧边栏
  ui/                   # 基础 UI 组件
docs/                   # 项目开发指南
lib/                    # 通用工具、SSE 解析、SiliconFlow 配置
prisma/                 # schema、migrations、seed 入口
server/
  auth/                 # JWT、Cookie、鉴权工具
  chat/                 # 生成任务管理
  db/                   # Prisma client 与 seed 逻辑
  repositories/         # 数据访问层
```

更细的模块说明见 [docs/project-map.md](docs/project-map.md)。

## API 概览

- `POST /api/auth/login`：登录并写入 session cookie。
- `POST /api/auth/logout`：退出登录。
- `GET /api/auth/me`：读取当前登录用户。
- `POST /api/chat`：发送聊天消息并返回 SSE 流。
- `POST /api/chat/continue`：继续生成指定 assistant 消息。
- `GET /api/conversations`：获取当前用户的会话列表。
- `POST /api/conversations`：创建会话。
- `GET /api/conversations/[conversationId]`：获取会话详情。
- `PATCH /api/conversations/[conversationId]`：更新会话标题。
- `DELETE /api/conversations/[conversationId]`：删除会话。
- `POST /api/conversations/[conversationId]/share`：开启公开分享。
- `DELETE /api/conversations/[conversationId]/share`：取消公开分享。
- `GET /api/share/[shareToken]`：读取公开分享内容。
- `POST /api/stt`：语音转文字。
- `POST /api/tts`：文字转语音。
- `POST /api/user/siliconflow-key`：保存当前用户的 SiliconFlow API Key。

## 开发约定

- TypeScript / TSX 使用 2 空格缩进、单引号和分号。
- import 顺序保持为：外部包、`@/` 别名、相对导入。
- 路由层负责鉴权、校验和编排；数据库查询集中在 `server/repositories/`。
- 请求 payload 使用 `zod` 校验，API 错误优先返回结构化 JSON。
- 涉及用户资源的查询必须携带 `userId`，避免跨用户访问。
- 修改 Prisma schema 后运行 `npm run db:generate`。
- 修改前端或 API 后，优先运行最小范围的 ESLint；跨模块改动再运行 `npm run build` 或 `npx tsc --noEmit`。

## 参考文档

- [项目地图](docs/project-map.md)
- [前端指南](docs/frontend-guide.md)
- [API 指南](docs/api-guide.md)
- [数据库指南](docs/database-guide.md)
- [认证指南](docs/auth-guide.md)
- [AI、SSE 和语音指南](docs/ai-voice-guide.md)
