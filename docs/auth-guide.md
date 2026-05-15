# 认证和权限指南

处理登录、登出、当前用户、JWT、Cookie 或用户数据隔离时阅读本文件。

## 核心文件

- `server/auth/jwt.ts`：签发和验证 JWT。
- `server/auth/utils.ts`：session cookie、当前用户解析、统一错误响应、登录 payload schema。
- `server/auth/password.ts`：bcrypt hash 与验证。
- `app/api/auth/login/route.ts`：登录。
- `app/api/auth/logout/route.ts`：登出。
- `app/api/auth/me/route.ts`：当前用户。
- `server/repositories/user.repository.ts`：用户读取和 API Key 更新。

## Session 机制

- 生产环境 Cookie 名称是 `__Host-session`；开发环境使用 `session`，避免本地 HTTP 下 `__Host-` + `Secure` 约束导致 Cookie 不可用。
- Cookie 配置：HttpOnly、sameSite lax、path `/`、生产环境 secure、7 天有效期。
- JWT 使用 HS256，issuer 和 audience 都固定为项目值。
- JWT subject 是用户 id，payload 包含 email 和 name。
- `AUTH_JWT_SECRET` 必须存在，否则签发或验证会失败。

## 鉴权模式

- 可选登录态使用 `getCurrentUserId()` 或 `getCurrentUserFromRequest()`。
- 必须登录的 route 使用 `requireCurrentUserId()` 或 `requireCurrentUser()`。
- 捕获到“请先登录”错误时返回 `createUnauthorizedResponse()`。
- `/api/auth/me` 在 session 无效时会清除 cookie。

## 权限隔离

- 会话相关 API 必须通过 `userId + conversationId` 双条件校验资源归属。
- 不能只根据 conversationId 更新或删除用户资源。
- user-owned 数据的 repository 方法应体现归属语义，例如 `findOwnedById`。
- 返回用户对象时不要包含 `passwordHash` 或完整 secrets。

## 安全注意

- 不要把完整 JWT、API Key、passwordHash 打到日志。
- 登录失败统一返回“邮箱或密码错误”，避免泄露账号是否存在。
- 更新 SiliconFlow API Key 时可保存 null，用于清空配置。

## 认证任务验证

- 单 route 改动先运行 `npx eslint app/api/auth/<route>/route.ts`。
- 改 JWT payload 或 cookie 行为时，同步检查 login、me、logout 和需要鉴权的 API。
- 权限改动需要手动覆盖未登录、登录但资源不属于当前用户、正常用户三种路径。
