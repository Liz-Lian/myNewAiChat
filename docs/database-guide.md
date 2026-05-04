# 数据库和 Prisma 指南

处理 Prisma schema、迁移、seed、repository 和数据库相关 API 时阅读本文件。

## 当前模型

- `User`
  - `id`、`email`、`name`、`passwordHash`、`siliconflowApiKey`、timestamps。
  - `email` 唯一。
  - 拥有多个 `Conversation`。
- `Conversation`
  - `id`、`userId`、`title`、`messages`、timestamps。
  - 关联 `User`，用户删除时 cascade。
  - `@@index([userId, updatedAt(sort: Desc)])` 支持按用户列出最近会话。
- `Message`
  - `id`、`conversationId`、`role`、`content`、`toolCalls`、`createdAt`。
  - 关联 `Conversation`，会话删除时 cascade。
  - `role` 当前 schema 是 `String`，应用层按 `'user' | 'assistant'` 约束。

## Prisma client

- `prisma/schema.prisma` 中 generator 输出到 `app/generated/prisma`。
- `server/db/client.ts` 从 `app/generated/prisma/client` 导入 PrismaClient。
- 项目使用 `@prisma/adapter-pg`，连接串来自 `DATABASE_URL`。
- 开发环境通过 global 单例复用 PrismaClient，避免热更新造成连接泄漏。

## Repository 约定

- `server/repositories/user.repository.ts` 封装用户读写和 seed upsert。
- `server/repositories/conversation.repository.ts` 封装会话列表、创建、归属检查、标题更新、删除、touch。
- `server/repositories/message.repository.ts` 封装消息创建和按会话读取。
- 新增数据库查询优先放到 repository，路由层只做编排。

## 迁移与生成

- schema 变更后运行 `npm run db:generate` 或 `npm run prisma:generate`。
- 本地开发创建迁移用 `npm run db:migrate` 或 `npm run prisma:migrate`。
- 只需同步开发库且不需要迁移文件时，可用 `npm run db:push` 或 `npm run prisma:push`。
- 不要手改 `app/generated/prisma` 下的生成文件。

## Seed

- seed 入口是 `prisma/seed.ts`，核心逻辑在 `server/db/seed.ts`。
- 默认管理员：`admin@local.dev` / `Admin@123456`。
- 可通过 `SEED_ADMIN_EMAIL`、`SEED_ADMIN_NAME`、`SEED_ADMIN_PASSWORD`、`SEED_ADMIN_SILICONFLOW_API_KEY` 覆盖。
- seed 会 upsert 管理员用户，不会创建默认 conversation。

## 数据库任务验证

- schema 改动后至少运行 Prisma generate。
- 影响 repository 返回字段时，同步检查使用方的 TypeScript 类型。
- 权限相关查询必须验证 userId 隔离，避免跨用户读取、更新、删除。
