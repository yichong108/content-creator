# 计划：添加 Customer Service 移动端入口页面

## 需求

新增一个移动端客服入口页面 `customer-service`，包含：
- 引用已有 `WechatChatMessageList` 组件渲染消息列表
- 底部添加可交互的输入框 + 发送按钮
- 保持微信风格 UI

## 实现步骤

### 1. 新建 `apps/web/src/pages/CustomerServicePage.tsx`

**布局结构**（参考 `ChatPage.tsx` 的整体框架）：

```
<main h-dvh max-w-md flex-col>       ← 移动端适配容器
  ├── <header>                       ← 顶部导航（返回按钮 + "客服" 标题）
  ├── <WechatChatMessageList />      ← 消息列表（纯展示组件）
  └── <footer>                       ← 输入表单（input + 发送按钮）
```

**组件状态**：
- `chatItems: ChatItem[]` — 用 `useState` 管理，初始为 mock 欢迎消息
- `draft: string` — 输入框草稿

**mock 初始化数据**（注意：`incoming`/`outgoing` 必须携带完整 `ChatItemNpcInfo`）：
```ts
// 客服端（incoming）— 使用 /avatar-other.png
{
  kind: "incoming",
  npc_id: 1,
  npc_name: "客服小助手",
  npc_avatar_url: "/avatar-other.png",
  text: "您好，请问有什么可以帮您？",
}
// 用户发送（outgoing）— 使用 /avatar-self.png
{
  kind: "outgoing",
  npc_id: 0,
  npc_name: "我",
  npc_avatar_url: "/avatar-self.png",
  text: "我想咨询一下...",
}
```

**发送逻辑**：
```ts
const handleSend = () => {
  const text = draft.trim();
  if (!text) return;
  setChatItems(prev => [...prev, {
    kind: "outgoing",
    npc_id: 0,
    npc_name: "我",
    npc_avatar_url: "/avatar-self.png",
    text,
  }]);
  setDraft("");
};
```

**底部输入栏**（直接复用 `ChatPage.tsx` L113-131 的实现）：
```tsx
<footer className="shrink-0 border-t-[0.5px] border-black/[0.05] bg-[var(--wechat-composer-bg)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
  <form className="flex items-end gap-2" onSubmit={handleSubmit}>
    <input type="text" ... placeholder="输入消息" />
    <button type="submit" disabled={!draft.trim()}>发送</button>
  </form>
</footer>
```

### 2. 修改 `apps/web/src/router.tsx`

新增 2 行：
```tsx
import { CustomerServicePage } from "@/pages/CustomerServicePage";
// ...
<Route path="customer-service" element={<CustomerServicePage />} />
```

### 3. 入口导航（可选，待用户确认）

如果需要从首页导航到 `/customer-service`，可在 `WechatSessionListPage.tsx` 的 `WechatHeaderMoreMenu` 菜单项中添加：
```ts
{ key: "customer-service", label: "客服", onClick: () => navigate("/customer-service") }
```
**此步暂不实施**，先让页面可直接通过 URL 访问验证。

## ChatItem 接口确认（来自 `@contentcreator/chat-item`）

```ts
type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | ({ kind: "incoming"; text: string } & ChatItemNpcInfo)
  | ({ kind: "outgoing"; text: string } & ChatItemNpcInfo);

type ChatItemNpcInfo = {
  npc_id: number;
  npc_name: string;
  npc_avatar_url: string;  // 空字符串不会被 resolveChatItemAvatarUrl fallback
};
```

## 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| **新增** | `apps/web/src/pages/CustomerServicePage.tsx` | 客服页面主组件 |
| **修改** | `apps/web/src/router.tsx` | 添加 import + Route（2 行） |

## 不修改的文件

- `WechatChatMessageList.tsx` — 直接复用
- `WechatChatPage.tsx` — 不修改（输入栏是静态图片）
- `index.css` — 微信气泡/输入框样式已完备
- `WechatSessionListPage.tsx` — 暂不添加导航入口

## 后续接入真实 API 时

将 `useState` mock 数据替换为：
- 初始化调用客服会话 API
- 发送消息调用客服消息发送 API
- 接入 WebSocket 接收对方回复

可参考 `ChatPage.tsx` + `useLiveChatStream` 的模式。
