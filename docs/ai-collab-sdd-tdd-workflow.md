<!-- 本文件记录ai-collab-sdd-tdd-workflow相关的项目说明与协作指南。 -->

# AI 协作 SDD/TDD 工作流

本文件是本仓库的标准化 AI 开发入口。涉及新功能、跨文件改动、多步骤改造、接口联调、数据库变更时，先读本文件，再决定是否开始实现。

## 适用范围

- 新增功能
- 前后端联动改造
- API 契约调整
- 数据库和 repository 变更
- 登录态、权限、SSE、取消请求等高风险行为

## 输入格式

每次发起任务时，先补齐这些信息：

- 功能名：
- 需求描述：
- 前端修改点：
- 后端修改点：
- 接口/数据变更：
- 验收标准：

如果缺少关键字段，先提问确认，不要直接进入实现。

## 标准流程

### 1. 先读上下文

优先阅读：

- `AGENTS.md`
- `docs/project-map.md`
- 任务相关的 guide
- 目标入口文件和上下游文件

### 2. 先出 SDD 文档包

对每个功能拆成前端和后端两组 SDD 文档包。

建议路径：

- `docs/sdd-propose/<feature-name>/frontend/proposal.md`
- `docs/sdd-propose/<feature-name>/frontend/spec.md`
- `docs/sdd-propose/<feature-name>/frontend/tasks.md`
- `docs/sdd-propose/<feature-name>/backend/proposal.md`
- `docs/sdd-propose/<feature-name>/backend/spec.md`
- `docs/sdd-propose/<feature-name>/backend/design.md`
- `docs/sdd-propose/<feature-name>/backend/tasks.md`

前端文档：

- `proposal.md`：需求提案，描述前端要做什么、为什么做、用户会看到什么变化。
- `spec.md`：技术规格，描述组件设计、接口调用、状态管理、交互状态。
- `tasks.md`：任务拆分，每个 task 对应一个可执行的代码变更。

后端文档：

- `proposal.md`：需求提案，描述后端要做什么、为什么做、对外能力变化。
- `spec.md`：技术规格，描述接口设计、数据库设计、分层架构、错误处理。
- `design.md`：详细设计，描述字段映射、SQL/Prisma 查询、时序、权限和边界条件。
- `tasks.md`：任务拆分，每个 task 对应一个可执行的代码变更。

每份 SDD 文档都必须写清楚：

- 目标
- 变更边界
- 入口文件
- 数据流或接口流
- 错误与空态
- 依赖关系
- 不做什么
- 验证方式

### 3. 用户审查 SDD

生成完整 SDD 文档包后必须停止，向用户汇报文档路径和待审查要点。

用户明确同意前，不要：

- 写实现代码
- 修改业务源码
- 创建迁移
- 安装依赖
- 启动前后端 agent 实现

如果用户要求修改 SDD，先更新文档包，再次等待确认。

### 4. 再出 TDD 计划

先列测试，再写实现。

测试优先级：

1. 纯函数和解析逻辑
2. repository 和服务端编排
3. API 校验和错误响应
4. 前端状态流和交互
5. 端到端关键路径

如果仓库尚未具备完整测试基础，先补最小可执行的测试基础，再进入实现。

TDD 计划可以写入各自的 `tasks.md`，也可以在复杂任务中单独新增：

- `docs/sdd-propose/<feature-name>/frontend/test-plan.md`
- `docs/sdd-propose/<feature-name>/backend/test-plan.md`

### 5. 再分 agent 实现

- 前端 agent：只负责前端文件和状态/UI。
- 后端 agent：只负责 API、repository、schema、auth。
- 不要互相覆盖对方的责任文件。

### 6. 最后验证

最小验证优先级：

- 单文件：`npx eslint <file>`
- 跨模块：`npx tsc --noEmit`
- 行为变化明显：`npm run build`

涉及数据库时，补充 Prisma generate / migrate / push。

## 前端 SDD 要点

### `frontend/proposal.md`

- 用户目标
- 前端范围
- 主要页面和入口
- 用户可感知变化
- 不做什么

### `frontend/spec.md`

- 页面和组件入口
- 状态流转
- 交互状态：loading、error、empty、disabled、cancel
- 与后端接口的调用时机和字段
- 与现有 store / hook 的关系

### `frontend/tasks.md`

- 每个 task 都要有明确文件范围
- 每个 task 都要能单独验证
- 避免“重构 UI”这类不可检查描述

## 后端 SDD 要点

### `backend/proposal.md`

- 后端目标
- 对外 API 能力变化
- 数据或权限影响
- 不做什么

### `backend/spec.md`

- API 契约
- 请求/响应结构
- 鉴权和资源归属
- repository 边界
- 数据库变更
- 错误处理
- 流式或异步行为

### `backend/design.md`

- 路由到 repository 的调用链
- 字段映射
- SQL/Prisma 查询策略
- 权限检查顺序
- 事务和一致性要求
- 错误码和错误响应
- 时序图或类图（复杂任务需要）

### `backend/tasks.md`

- 每个 task 都要有明确文件范围
- 数据库 task 要写明 generate / migrate / push
- API task 要写明正常、鉴权失败、参数错误、资源不存在等验证

## TDD 要点

优先给这些地方写测试：

- `lib/` 下的纯逻辑
- `server/auth/`
- `server/repositories/`
- `app/api/`
- `app/features/chat/store/`

重点覆盖：

- 正常路径
- 边界条件
- 非法输入
- 权限失败
- 取消/中断
- 上游失败

## 交付要求

在开始编码前，必须能回答这几个问题：

- 这次改动的边界在哪里
- 哪些文件会变，哪些不会变
- SDD 文档包和 TDD 计划放在哪里
- 用户是否已经审查并同意 SDD
- 如何验证不会破坏现有聊天、鉴权、SSE 和数据归属
