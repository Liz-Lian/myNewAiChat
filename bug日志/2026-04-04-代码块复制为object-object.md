# Bug 日志：代码块复制结果变成 `[object Object]`

- 日期：2026-04-04
- 严重级别：中
- 影响范围：聊天消息中的 Markdown 代码块复制功能
- 相关文件：`app/features/chat/components/MessageContent/CodeBlock.tsx`
- 关联提交（可选）：未记录

## 现象

点击代码块右上角复制按钮后，粘贴出来的内容不是实际代码，而是：

```text
[object Object]([object Object])
```

## 复现步骤

1. 进入聊天页面，发送包含 Markdown 代码块的消息。
2. 在渲染出的代码块右上角点击 `Copy`。
3. 在任意输入框粘贴内容。
4. 观察到粘贴内容是 `[object Object]([object Object])`。

## 预期结果

粘贴内容应为代码块中的原始代码文本。

## 实际结果

粘贴内容为对象字符串表示，而不是代码文本。

## 根因分析

`CodeBlock` 中用于提取代码文本的逻辑 `getCodeString(children)` 过于简单：

- 仅处理了字符串和数组
- 对其他类型直接 `String(children)`

在 React Markdown 渲染代码块时，`children` 可能包含 React 元素节点而非纯字符串。节点被 `String(...)` 转换后变成 `[object Object]`，导致复制结果错误。

## 修复方案

在 `CodeBlock.tsx` 中将代码文本提取逻辑改为递归提取纯文本：

1. 新增 `extractText(node)`。
2. 按类型处理：
   - `string` / `number`：直接转文本返回。
   - `null` / `undefined` / `boolean`：返回空字符串。
   - `Array`：递归提取并拼接。
   - React element：递归读取 `props.children`。
3. `getCodeString(children)` 改为调用 `extractText(children)`。

## 修复结果

复制按钮现在可以正确复制代码块中的真实代码内容，不再出现 `[object Object]`。

## 验证

- 静态检查：`npm run lint` 通过。
- 功能验证：复制代码块后粘贴结果为原始代码文本。
- 边界验证（可选）：包含行内代码与多行代码块时复制均正常。

## 回归风险

- 风险点 1：不同 Markdown 插件下 `children` 结构可能变化。
- 风险点 2：若后续改造 `code` 渲染器，需确保 `extractText` 逻辑继续覆盖新节点形态。

## 后续行动（可选）

- [ ] 增加一个针对代码块复制内容的组件测试。
- [ ] 在聊天回归清单中加入“代码复制正确性”检查项。
- [ ] 如后续引入更多 Markdown 插件，补充兼容性回归案例。

## 经验总结

- 对 React 节点做文本提取时，避免直接 `String(node)`。
- 涉及 Markdown/富文本渲染链路时，`children` 形态通常比预期更复杂，应按 `ReactNode` 全分支处理。
