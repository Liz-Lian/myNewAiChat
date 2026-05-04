# 提交 1e2e941 后端登录与会话持久化总结

提交：`1e2e941e5832a0810e86cbedcb97a6c5ad834287`

提交信息：`feat：实现登录和会话持久化功能后端`

提交时间：2026-04-15 15:40:19 +0800

## 整体做了什么

这次提交把项目从“前端直接发起一次性聊天请求”的状态，推进到了“有用户、有登录态、有私有 API Key、有会话和消息持久化”的后端基础形态。

主要变化包括：

- 新增 `User`、`Conversation`、`Message` 三张核心表，并建立用户到会话、会话到消息的级联关系。
- 新增基于 JWT 和 `__Host-session` HttpOnly Cookie 的登录态。
- 新增登录、登出、当前用户、用户 SiliconFlow API Key 保存接口。
- 新增会话列表、创建、详情、改名、删除接口。
- 改造 `/api/chat`，要求用户登录，读取当前用户自己的 SiliconFlow API Key，并把 user/assistant 消息写入数据库。
- 把 SSE 解析逻辑抽成 `lib/chat-sse.ts`，让前后端共用同一套流式解析能力。
- 新增 Prisma seed，用于初始化管理员账号和可选的 SiliconFlow API Key。

## 为什么这样设计

### 认证使用 JWT + HttpOnly Cookie

登录后服务端签发 JWT，并写入 `__Host-session` Cookie。这样前端不用手动保存 token，也避免 token 暴露在 localStorage 中。Cookie 使用 HttpOnly、sameSite lax、生产环境 secure，满足单站点应用里较常见的会话安全需求。

JWT 里只放用户 id、email、name 这类轻量身份信息。请求进来后再用用户 id 查询数据库，确保用户被删除、API Key 更新等状态能及时反映到后端行为。

### 路由层不直接散写 Prisma 查询

提交新增了 `server/repositories/`，把用户、会话、消息的数据访问封装起来。Route Handler 负责鉴权、参数校验、响应编排；repository 负责具体 Prisma 查询。这样可以把 `userId + conversationId` 这类权限隔离条件固定在语义化方法里，减少以后新增接口时漏掉归属校验的风险。

### 会话归属通过 userId 强约束

会话接口和聊天接口都先获取当前用户 id，再用 `userId` 过滤会话。更新和删除也不是只按 `conversationId` 操作，而是通过 `userId + conversationId` 双条件确认资源归属。这个设计的核心目的，是防止用户猜到别人的会话 id 后跨用户读取、改名或删除。

### SiliconFlow API Key 改为用户级配置

旧聊天接口使用环境变量里的 `SILICONFLOW_API_KEY`。这次改为读取当前登录用户自己的 `siliconflowApiKey`，并新增接口允许用户保存或清空。这样后端能支持多用户，每个用户用自己的模型服务密钥，不再把全站聊天能力绑定到一个全局 key。

### SSE 解析抽到共享模块

原先前端 store 里自己逐行解析 SSE。提交把这部分拆到 `lib/chat-sse.ts`，后端 `/api/chat` 用它从上游流里提取 assistant delta 以便落库，前端 store 也用它更新 UI。这样可以避免前后端各维护一份容易漂移的流解析逻辑。

## 文件说明

### 认证接口

#### `app/api/auth/login/route.ts`

新增登录接口 `POST /api/auth/login`。

职责：

- 使用 `loginRequestSchema` 校验邮箱和密码。
- 根据邮箱查询用户。
- 使用 bcrypt 校验密码哈希。
- 登录成功后签发 JWT，并写入 `__Host-session` Cookie。
- 返回不含 `passwordHash` 的用户信息。

设计原因：

- 登录失败统一返回“邮箱或密码错误”，避免暴露邮箱是否存在。
- 登录成功返回用户基础信息，方便前端初始化用户态。
- 响应加 `Cache-Control: no-store`，避免会话相关响应被缓存。

#### `app/api/auth/logout/route.ts`

新增登出接口 `POST /api/auth/logout`。

职责：

- 返回登出成功消息。
- 清空 `__Host-session` Cookie。

设计原因：

- 登出本质上是清除客户端会话 Cookie，不依赖数据库状态。
- 保持 POST 语义，避免 GET 请求被预加载或缓存时触发状态变更。

#### `app/api/auth/me/route.ts`

新增当前用户接口 `GET /api/auth/me`。

职责：

- 从请求 Cookie 中解析当前用户。
- JWT 无效、用户不存在或未登录时返回 401。
- 会话无效时顺手清除 Cookie。
- 登录有效时返回用户 id、email、name。

设计原因：

- 给前端刷新页面后恢复登录态使用。
- JWT 校验后再查数据库，能处理用户已被删除的情况。
- 不返回 passwordHash 和 API Key，避免敏感字段泄露给前端。

### 用户配置接口

#### `app/api/user/siliconflow-key/route.ts`

新增用户 API Key 更新接口 `PATCH /api/user/siliconflow-key`。

职责：

- 要求用户已登录。
- 校验 `apiKey`，允许字符串或 `null`。
- 对输入做 trim，空字符串归一化为 `null`。
- 更新当前用户的 `siliconflowApiKey`。
- 返回 `hasApiKey`，告诉前端当前是否已配置。

设计原因：

- SiliconFlow Key 属于用户私密配置，不能再用全局环境变量承载多用户场景。
- 接口只返回是否存在，不回显完整 key，降低泄露风险。
- 允许传 `null`，方便前端提供“清空配置”能力。

### 聊天与会话接口

#### `app/api/chat/route.ts`

改造聊天接口 `POST /api/chat`。

职责：

- 要求用户登录。
- 校验请求中的 `messages`、可选 `conversationId`、可选 `title`。
- 从当前用户读取 SiliconFlow API Key。
- 没有 `conversationId` 时自动创建新会话。
- 有 `conversationId` 时校验该会话属于当前用户。
- 写入最新一条 user 消息。
- 调用 SiliconFlow `/chat/completions` 流式接口。
- 把上游 SSE 继续转发给前端。
- 同时解析 assistant delta，流结束后把完整 assistant 回复写入数据库。
- 响应头返回 `X-Conversation-Id`，方便前端记录新建会话 id。

设计原因：

- 聊天发送、会话创建、消息落库在一个接口里完成，前端第一次发送消息时不需要先单独创建会话。
- 只保存最新 user 消息，是因为前端每次提交的是完整上下文，但数据库不应该重复写入历史消息。
- assistant 回复必须等流结束后再落库，避免保存半截内容；中断时不会保存空回复。
- 保留流式转发，用户体验仍然是逐字/逐块输出。

#### `app/api/conversations/route.ts`

新增会话集合接口。

职责：

- `GET /api/conversations`：返回当前用户的会话列表，按 `updatedAt` 倒序。
- `POST /api/conversations`：为当前用户创建新会话，默认标题为“新对话”。

设计原因：

- 列表接口只返回会话元信息，不返回消息，适合侧边栏快速加载。
- 创建接口强制绑定当前用户 id，避免前端传入 userId 造成越权。
- 使用 `Cache-Control: no-store`，保证会话列表实时反映最新消息活动。

#### `app/api/conversations/[conversationId]/route.ts`

新增单会话接口。

职责：

- `GET`：获取当前用户拥有的指定会话。
- `PATCH`：修改当前用户拥有的指定会话标题。
- `DELETE`：删除当前用户拥有的指定会话。

设计原因：

- 每个操作都先鉴权，再做资源归属校验。
- 更新前先检查 `findOwnedIdOnly`，让不存在和无权限统一表现为“会话不存在”。
- 删除使用 `deleteMany` 搭配 `userId + conversationId`，同时完成权限约束和删除结果判断。

#### `lib/chat-sse.ts`

新增 SSE 解析工具。

职责：

- `splitSseLines`：把流式文本按行切分，并保留未完整到达的半行。
- `getSseDataPayload`：提取 `data: ` 后面的 payload，忽略 `[DONE]`。
- `extractAssistantDelta`：从 OpenAI/SiliconFlow 兼容格式中提取 `choices[0].delta.content`。
- `consumeSseStream`：消费 `ReadableStream`，支持原样转发 chunk、提取 delta、外部停止。

设计原因：

- 前端 UI 和后端落库都需要解析同一种 SSE 格式，抽公共工具能减少重复。
- `onChunk` 保证后端可以边解析边透传，不破坏流式体验。
- `onDelta` 让后端累积完整 assistant 内容，前端累积 UI 内容。
- `shouldStop` 支持请求过期或取消时及时停止消费。

### 前端状态衔接

#### `app/features/chat/store/useChatStore.ts`

改造聊天 Zustand store。

职责变化：

- 新增 `conversationId` 状态。
- 发送聊天请求时带上当前 `conversationId`。
- 从响应头 `x-conversation-id` 读取后端返回的会话 id。
- 使用 `consumeSseStream` 替代 store 内部手写 SSE 解析。
- 保留 requestId、AbortController、currentReader 这些并发和取消控制。

设计原因：

- 前端需要知道当前消息属于哪个持久化会话，后续继续对话时传回后端。
- 新会话第一次发送消息时，后端创建会话并通过响应头返回 id，前端无需额外请求。
- 复用公共 SSE 解析逻辑，降低前端解析 bug 和后端落库解析不一致的概率。

### 数据库模型、迁移和 seed

#### `prisma/schema.prisma`

修改 Prisma schema。

职责变化：

- `Conversation` 新增 `userId`、`user`、`updatedAt`。
- `Conversation` 新增 `@@index([userId, updatedAt(sort: Desc)])`。
- `Message` 新增 `toolCalls` JSON 字段。
- `Message` 新增 `@@index([conversationId, createdAt])`。
- 新增 `User` 模型，包含 email、name、passwordHash、siliconflowApiKey 和 timestamps。

设计原因：

- `User -> Conversation -> Message` 是聊天持久化最小模型。
- `Conversation.updatedAt` 用于侧边栏“最近会话”排序。
- 两个索引分别服务会话列表和消息列表两个高频查询。
- `toolCalls` 预留给未来工具调用或函数调用消息。
- `onDelete: Cascade` 让删除用户时清理会话，删除会话时清理消息。

#### `prisma/migrations/202604150001_init_user_conversation_message/migration.sql`

新增数据库迁移 SQL。

职责：

- 创建 `User`、`Conversation`、`Message` 表。
- 创建 email 唯一索引、会话列表索引、消息列表索引。
- 创建外键关系和级联删除规则。

设计原因：

- 把 schema 的结构变化固化为可复现迁移，便于其他环境应用同一数据库结构。

#### `prisma/migrations/migration_lock.toml`

新增 Prisma 迁移锁文件。

职责：

- 记录迁移使用的数据库 provider 是 PostgreSQL。

设计原因：

- Prisma migrate 用它识别迁移历史和数据库类型，避免不同 provider 混用。

#### `prisma.config.ts`

修改 Prisma 配置。

职责变化：

- 在 `migrations` 配置中新增 seed 命令：`tsx prisma/seed.ts`。

设计原因：

- 让 `prisma db seed` 能直接找到项目 seed 入口。

#### `prisma/seed.ts`

新增 Prisma seed 入口。

职责：

- 加载环境变量。
- 调用 `server/db/seed.ts` 的 `runSeed()`。
- 执行结束后断开 Prisma 连接。

设计原因：

- 保持 Prisma CLI 入口很薄，实际 seed 逻辑放在服务端模块中，方便复用和测试。

#### `server/db/seed.ts`

新增 seed 核心逻辑。

职责：

- 检查 `DATABASE_URL`。
- 读取管理员账号环境变量。
- 使用 bcrypt 生成密码哈希。
- upsert 管理员用户。
- 可选写入管理员 SiliconFlow API Key。

设计原因：

- 用 upsert 保证 seed 可重复运行。
- 默认管理员便于本地开发快速登录。
- 允许环境变量覆盖，避免把真实凭据写进代码。

#### `server/db/client.ts`

新增 Prisma Client 单例。

职责：

- 使用 `@prisma/adapter-pg` 初始化 Prisma PostgreSQL 适配器。
- 从 `DATABASE_URL` 建立连接。
- 开发环境把 Prisma Client 放到 global，避免热更新重复创建连接。

设计原因：

- Next.js 开发环境热更新频繁，如果每次模块重载都新建 Prisma Client，容易导致数据库连接过多。
- 移到 `server/db/client.ts` 后，数据库客户端属于服务端层，不再放在通用 `lib/` 下。

#### `lib/prisma.ts`

删除旧 Prisma Client 文件。

职责变化：

- 原先在 `lib/` 下导出 Prisma Client。
- 本提交改由 `server/db/client.ts` 承担该职责。

设计原因：

- `lib/` 通常会混放前后端可用工具，把 Prisma Client 放在 `server/db/` 更清晰地表达“只能服务端使用”。
- 新路径也和 repository 层放在 `server/` 下的边界一致。

### 认证和数据访问基础模块

#### `server/auth/jwt.ts`

新增 JWT 模块。

职责：

- 读取 `AUTH_JWT_SECRET`。
- 使用 `jose` 签发 HS256 JWT。
- 设置 issuer、audience、subject、issuedAt、expiration。
- 校验 JWT 并返回标准化 `AuthPayload`。

设计原因：

- JWT 细节集中在一个模块，路由层不需要关心签名算法和 claim 校验。
- issuer 和 audience 能防止 token 被错误地用于其他上下文。
- 7 天过期时间和 Cookie maxAge 保持一致。

#### `server/auth/password.ts`

新增密码模块。

职责：

- 使用 bcrypt 哈希明文密码。
- 使用 bcrypt 校验明文密码和哈希是否匹配。

设计原因：

- 密码处理集中封装，登录和 seed 都复用同一套哈希策略。
- bcrypt salt rounds 固定为 10，适合本地和常规服务端场景的成本平衡。

#### `server/auth/utils.ts`

新增认证工具模块。

职责：

- 定义登录请求 schema。
- 读写和清除 `__Host-session` Cookie。
- 统一创建 JSON 错误响应和 401 响应。
- 从请求 Cookie 解析当前用户。
- 提供可选鉴权和强制鉴权两个层级：`getCurrentUserId` / `requireCurrentUserId`。

设计原因：

- Route Handler 中的鉴权样板代码很多，集中后能保持错误格式和 Cookie 行为一致。
- `requireCurrentUserId` 通过抛出统一错误，配合 route catch 分支简化未登录处理。
- `getCurrentUserFromRequest` 会查数据库，保证 JWT 有效但用户不存在时不会继续放行。

#### `server/repositories/user.repository.ts`

新增用户仓储。

职责：

- 根据 email 查询用户。
- 根据 id 查询用户。
- 更新当前用户 SiliconFlow API Key。
- seed 时 upsert 管理员账号。

设计原因：

- 用户表访问集中封装，避免 route 直接返回敏感字段或散写查询。
- `upsertAdminUser` 服务 seed 的幂等初始化。

#### `server/repositories/conversation.repository.ts`

新增会话仓储。

职责：

- 按用户列出会话。
- 为用户创建会话。
- 查询用户拥有的会话详情。
- 只查询用户是否拥有某会话 id。
- 修改用户拥有的会话标题。
- 删除用户拥有的会话。
- 刷新会话 `updatedAt`。

设计原因：

- 方法名带 `Owned`，提醒调用方这是带用户归属语义的操作。
- 更新和删除都通过 `userId` 过滤，避免越权。
- `touch` 用于消息写入后刷新会话排序。

#### `server/repositories/message.repository.ts`

新增消息仓储。

职责：

- 创建消息。
- 按会话时间顺序列出消息。

设计原因：

- 聊天接口只需要编排“写 user 消息”和“写 assistant 消息”，不需要知道 Prisma 字段细节。
- `listByConversation` 为后续会话详情加载完整消息预留能力。

### 依赖和脚本

#### `package.json`

修改依赖和脚本。

职责变化：

- 新增数据库脚本：`db:generate`、`db:migrate`、`db:seed`、`db:studio`、`db:push`、`db:init`。
- 新增生产依赖：`bcrypt`、`jose`、`zod`。
- 新增开发依赖：`@types/bcrypt`、`tsx`。
- 新增 `prisma.seed` 配置。

设计原因：

- `bcrypt` 支持密码哈希。
- `jose` 支持 JWT 签发和校验。
- `zod` 支持 API payload 校验。
- `tsx` 用于直接执行 TypeScript seed 文件。
- `db:*` 脚本给常用 Prisma 命令提供更清晰的别名。

#### `package-lock.json`

更新 npm 锁文件。

职责：

- 锁定新增依赖及其传递依赖版本。
- 保证其他环境安装到同一套依赖树。

设计原因：

- `package.json` 新增依赖后必须同步 lockfile，避免 CI 或其他开发机安装结果漂移。

## 关键数据流

### 登录数据流

1. 前端调用 `POST /api/auth/login`，提交 email 和 password。
2. 后端用 zod 校验请求体。
3. `userRepository.findByEmail()` 查用户。
4. `verifyPassword()` 校验密码。
5. `createSessionToken()` 签发 JWT。
6. `setSessionCookie()` 写入 `__Host-session`。
7. 前端拿到用户基础信息，后续请求自动携带 Cookie。

### 聊天持久化数据流

1. 前端 store 把当前消息列表和 `conversationId` 发给 `POST /api/chat`。
2. 后端通过 Cookie 获取当前用户。
3. 后端读取当前用户的 SiliconFlow API Key。
4. 如果没有 `conversationId`，创建新会话；如果有，校验归属。
5. 后端写入最新 user 消息，并刷新会话更新时间。
6. 后端调用 SiliconFlow 流式接口。
7. 后端把上游 SSE chunk 原样转发给前端。
8. 后端同时解析 delta，累积 assistant 完整回复。
9. 流结束后写入 assistant 消息，并再次刷新会话更新时间。
10. 前端从响应头保存 `x-conversation-id`，后续消息继续归入同一会话。

## 这次提交后的能力边界

已经具备：

- 基础登录、登出、当前用户查询。
- 服务端会话 Cookie。
- 用户私有 SiliconFlow API Key 保存。
- 会话 CRUD。
- 聊天消息持久化。
- SSE 流式转发和 assistant 内容落库。
- 管理员 seed。

仍需要注意：

- 当前没有注册接口，用户主要通过 seed 初始化。
- API Key 是明文存储在数据库字段中，后续如果要上线，应考虑加密存储或接入密钥管理服务。
- `Message.role` 在数据库里仍是 `String`，应用层约束为 `'user' | 'assistant'`；如果以后角色更多，可以考虑 Prisma enum。
- `/api/conversations/[conversationId]` 在该提交中只返回会话元信息，不返回消息列表；`messageRepository.listByConversation()` 已经预留读取消息能力。
- 聊天接口在保存 assistant 回复时依赖上游流正常结束；请求中断或上游异常时不会保存完整 assistant 消息。
