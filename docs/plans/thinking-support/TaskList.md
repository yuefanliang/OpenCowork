# Thinking 内容解析与展示 - TaskList

## Overview
为框架添加 LLM thinking/reasoning 内容的完整支持，包括 Anthropic extended thinking 和 OpenAI reasoning_content。
UI 参考：收起状态 `Thoughts >` 一行紧凑展示，展开后显示 Markdown 格式的 thinking 内容。

## 数据流
```
Provider (SSE) → StreamEvent(thinking_delta) → AgentLoop(AgentEvent) → use-chat-actions → ChatStore → AssistantMessage → ThinkingBlock 组件
```

## Tasks

- [ ] **Step 1: 类型定义**
  - 在 `api/types.ts` 中添加 `ThinkingBlock` 到 `ContentBlock` 联合类型
  - 在 `StreamEventType` 中添加 `thinking_delta`
  - 在 `StreamEvent` 中添加 `thinking?: string` 字段
  Priority: High | Effort: XS

- [ ] **Step 2: Anthropic Provider 解析**
  - `content_block_start` 处理 `type: "thinking"`
  - `content_block_delta` 处理 `delta.type: "thinking_delta"` → yield `thinking_delta` 事件
  - 不需要请求参数修改（thinking 参数由用户模型选择决定）
  Priority: High | Effort: S

- [ ] **Step 3: OpenAI Chat Provider 解析**
  - 检测 `delta.reasoning_content` 字段，yield `thinking_delta` 事件
  - 兼容 deepseek 等使用相同字段的 API
  Priority: High | Effort: XS

- [ ] **Step 4: Agent Loop 事件传递**
  - `AgentEvent` 添加 `thinking_delta` 类型
  - agent-loop.ts 中处理 `thinking_delta` StreamEvent → yield AgentEvent
  - 累积 thinking 文本到 `ThinkingBlock` ContentBlock
  Priority: High | Effort: S

- [ ] **Step 5: Chat Store 方法**
  - 添加 `appendThinkingDelta(sessionId, msgId, text)` 方法
  - 逻辑：找到或创建 ThinkingBlock，追加文本
  Priority: High | Effort: XS

- [ ] **Step 6: use-chat-actions 消费事件**
  - 主 agent loop 和 simple chat 中处理 `thinking_delta` 事件
  - 调用 `chatStore.appendThinkingDelta()`
  Priority: High | Effort: XS

- [ ] **Step 7: ThinkingBlock 组件**
  - 创建 `ThinkingBlock.tsx` 组件
  - 收起状态：`Thoughts >` 灰色文字 + 右箭头
  - 展开状态：`Thoughts ∨` + Markdown 渲染的 thinking 内容
  - 流式时自动展开，完成后默认收起
  Priority: High | Effort: M

- [ ] **Step 8: AssistantMessage 渲染**
  - 在 content block 渲染中添加 `case 'thinking'` 分支
  - 渲染 ThinkingBlock 组件
  Priority: High | Effort: XS

- [ ] **Step 9: Sub-Agent / Teammate 传递**
  - sub-agent runner 中传递 thinking_delta 事件
  - teammate-runner 中传递 thinking_delta 到 teamEvents
  - SubAgentCard / TeammateCard 中展示 thinking（可选，低优先级）
  Priority: Medium | Effort: S

- [ ] **Step 10: TypeCheck 验证**
  - 运行 `npm run typecheck` 确保无类型错误
  Priority: Medium | Effort: XS

## Progress Tracking
- Total Tasks: 10
- Completed: 0
- In Progress: 0
- Remaining: 10
