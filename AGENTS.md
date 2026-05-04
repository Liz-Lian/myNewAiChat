<!-- BEGIN:nextjs-agent-rules -->

# AGENTS.md

本仓库是一个使用 Next.js 16 App Router、React 19、TypeScript strict、ESLint、Tailwind CSS 4、Prisma 7、PostgreSQL、Zustand 和 SiliconFlow 的 AI 聊天应用。
在本仓库中编码时，请把这个文件当作入口索引；深入上下文按任务渐进式阅读对应文档。

## 渐进式发现

不要把所有背景一次性塞进上下文。先阅读本文件，再根据任务类型打开对应文档：

- 项目结构、模块边界、数据流总览 -> [docs/project-map.md](docs/project-map.md)
- 前端 UI、聊天组件、Zustand 状态、样式任务 -> [docs/frontend-guide.md](docs/frontend-guide.md)
- 后端 API、Route Handlers、错误响应、外部调用 -> [docs/api-guide.md](docs/api-guide.md)
- 数据库模型、Prisma client、迁移、seed -> [docs/database-guide.md](docs/database-guide.md)
- 登录态、JWT、Cookie、权限隔离 -> [docs/auth-guide.md](docs/auth-guide.md)
- 聊天流式响应、SiliconFlow、STT/TTS 语音能力 -> [docs/ai-voice-guide.md](docs/ai-voice-guide.md)
- 代码审查任务 -> [docs/code-review-guidelines.md](docs/code-review-guidelines.md)
- 大型重构或多步骤改造 -> [.agents/PLANS.md](.agents/PLANS.md)

如果任务跨多个领域，只阅读相关文档。例如“给会话列表接真实数据”通常需要 `frontend-guide`、`api-guide`、`database-guide`。

## 项目事实

- App Router 项目，页面与 API Route Handler 都在 `app/` 下。
- TypeScript 启用了 `strict: true`，模块别名 `@/*` 映射到仓库根目录。
- Prisma client 生成到 `app/generated/prisma`，服务端通过 `server/db/client.ts` 使用 PostgreSQL adapter。
- 认证使用 `__Host-session` HttpOnly Cookie + JWT，核心逻辑在 `server/auth/`。
- 数据访问集中在 `server/repositories/`，路由层不要直接散写 Prisma 查询。
- 聊天主流程是 `/api/chat` 转发 SiliconFlow SSE，前端 `useChatStore` 逐块更新最后一条 assistant 消息。
- 语音能力包括 `/api/stt`、`/api/tts`、`useVoiceRecorder`、`useSpeechPlayback`。
- UI 由 `components/` 和 `app/features/chat/components/` 下的小组件组成，使用 Tailwind 和 shadcn/radix 风格组件。
- 面向 Copilot 的镜像说明在 [`.github/copilot-instructions.md`](.github/copilot-instructions.md)；如果本文件关键规则变化，记得同步高信号内容。

## 常用命令

- `npm run dev` - 启动开发服务器。
- `npm run build` - 生产构建。
- `npm run start` - 运行已构建应用。
- `npm run lint` - 运行 ESLint。
- `npx eslint <path>` - 检查单个文件或目录。
- `npx eslint <path> --fix` - 自动修复指定目标。
- `npm run db:generate` 或 `npm run prisma:generate` - 生成 Prisma client。
- `npm run db:push` 或 `npm run prisma:push` - 同步 schema 到数据库。
- `npm run db:migrate` 或 `npm run prisma:migrate` - 创建并应用迁移。
- `npm run db:seed` - 执行 seed。
- `npm run db:studio` 或 `npm run prisma:studio` - 打开 Prisma Studio。

## 全局编码规则

- 使用分号；TypeScript/TSX/JS 使用单引号。
- import 顺序保持为：外部包、`@/` 别名、相对导入。
- 不要使用 `any`、`@ts-ignore`、`@ts-expect-error`，不要削弱类型来取悦编译器。
- React 组件用 PascalCase；hooks 和 Zustand stores 用 camelCase 且以 `use` 开头。
- Route Handlers 遵循 Next.js 约定，如 `export async function POST()`；需要 Node 能力时显式 `export const runtime = 'nodejs';`。
- 使用 `zod` 校验请求 payload，API 错误优先返回结构化 JSON。
- 使用 `cn()` from `lib/utils.ts` 合并条件 class name。
- 保持 diff 小而局部；除非任务要求，否则不要顺手重构无关代码。
- 保留现有消息流、loading 状态、取消请求和流式解析行为，除非任务明确要求改变。

## 验证预期

- 改动前先选最窄验证：单文件通常用 `npx eslint <file>`。
- 跨模块、类型或构建相关改动再运行 `npx tsc --noEmit` 或 `npm run build`。
- 数据库 schema 变更后运行 Prisma 生成，并按任务需要迁移或 push。
- 不要删除失败测试或忽略错误来制造通过结果；修根因。

## 如果不确定

- 先找职责最接近的现有文件，跟随它的命名、结构和错误处理方式。
- Next.js 16 行为如果看起来和旧经验不同，先查 `node_modules/next/dist/docs/`。
- 优先保持本仓库一致性，再考虑通用最佳实践。

<!-- END:nextjs-agent-rules -->
