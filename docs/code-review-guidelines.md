<!-- 本文件记录code-review-guidelines相关的项目说明与协作指南。 -->

# 代码审查指南

用户要求 review 时，优先找 bug、回归风险、权限问题和缺失验证，而不是总结代码写得如何。

## 审查优先级

- P0：会导致数据损坏、严重安全漏洞、应用无法启动或核心流程完全不可用。
- P1：主要功能错误、鉴权绕过、跨用户数据访问、生产构建失败。
- P2：边界条件错误、错误处理缺失、状态不同步、可复现的体验问题。
- P3：低风险可维护性问题，有明确后续收益时再指出。

## 本仓库高风险点

- API route 是否先鉴权，再校验资源归属。
- Conversation 和 Message 查询是否携带当前 userId 或经由 owned repository 方法。
- SSE partial chunks 是否被正确缓存，旧请求是否会覆盖当前请求。
- AbortController、reader cancel、reader releaseLock 是否完整。
- SiliconFlow 上游失败、空 body、无 API Key 是否有结构化错误。
- Cookie、JWT、API Key、passwordHash 是否被泄露到响应或日志。
- Prisma schema 改动后是否同步生成 client，并更新 repository 和使用方。

## 输出格式

- 先列 findings，按严重程度排序。
- 每条 finding 指向具体文件和行号，说明触发条件和实际影响。
- 没有发现问题时明确说“未发现阻塞性问题”，再说明剩余风险或未运行的验证。
- 总结和改动说明放在 findings 之后，保持简短。

## 审查前建议阅读

- API 或认证改动：`docs/api-guide.md`、`docs/auth-guide.md`。
- 数据库改动：`docs/database-guide.md`。
- 聊天流和语音改动：`docs/ai-voice-guide.md`。
- 前端状态或 UI 改动：`docs/frontend-guide.md`。
