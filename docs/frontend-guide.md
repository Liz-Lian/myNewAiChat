# 前端指南

处理 UI、交互、聊天状态和样式任务时阅读本文件。

## 主要文件

- `app/page.tsx`：当前聊天页面入口，组合 layout、message list、message input 和 Zustand store。
- `components/layouts/chat-layout.tsx`：页面骨架，组合 sidebar、header、主聊天区域。
- `components/sidebar/conversation-sidebar.tsx`：左侧会话列表，目前由 `app/page.tsx` 传入静态数据。
- `components/header/chat-header.tsx`：聊天头部。
- `app/features/chat/components/MessageList/MessageList.tsx`：消息列表、assistant 朗读控制、loading 展示。
- `app/features/chat/components/MessageInput/MessageInput.tsx`：文本输入、发送、停止、重试、录音入口。
- `app/features/chat/components/MessageContent/`：Markdown、代码块、复制按钮。
- `app/features/chat/hooks/`：语音录制和播放 hooks。
- `app/features/chat/store/useChatStore.ts`：聊天消息、流式请求、取消、重试状态。

## 状态与数据流

- `useChatStore` 是当前聊天状态中心，包含 `messages`、`conversationId`、`isGenerating`、`isLoading`、`error`。
- 发送消息时先把 user message 放入本地 state，再请求 `/api/chat`。
- 读取 SSE delta 时，如果 assistant message 尚未创建，先追加；后续 delta 原地替换最后一条 message。
- `currentRequestId` 用于防止旧请求或旧 reader 覆盖当前请求状态。
- 停止生成需要同时 abort controller、cancel reader，并清理当前请求状态。

## UI 约定

- 优先使用现有组件和 Tailwind 工具类。
- 条件 class 使用 `cn()`，不要手动拼接复杂字符串。
- 现有视觉语言偏 Gemini 风格：半透明背景、圆角、柔和边框、蓝色主色。
- 按钮内已有 lucide icons；新增操作也优先使用已有图标库。
- 避免把功能说明写进界面；让控件本身和状态文案承担信息。
- 移动端和窄宽度下要确认输入框、按钮、消息气泡不溢出。

## 当前注意点

- `app/page.tsx` 的会话列表是静态 mock 数据，后端已有 `/api/conversations`，但前端尚未完整接入。
- Sidebar 的“设置”“退出”按钮目前只展示 UI，没有绑定真实行为。
- 语音录制依赖浏览器 `navigator.mediaDevices.getUserMedia` 和 `MediaRecorder`，不支持时应保持文本输入可用。
- MessageList 中 assistant 朗读以 message key 区分活跃音频；改消息 key 时要避免破坏播放状态。

## 前端任务验证

- 单文件改动优先运行 `npx eslint <file>`。
- 跨多个组件或 hooks 的改动建议运行 `npm run lint`。
- 涉及类型或 Next 边界时运行 `npx tsc --noEmit` 或 `npm run build`。
