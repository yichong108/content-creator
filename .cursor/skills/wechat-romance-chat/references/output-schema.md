# ChatItem 输出规范

## TypeScript 类型

```typescript
type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | { kind: "incoming"; text: string }
  | { kind: "outgoing"; text: string };
```

## 字段规则

| kind | text 含义 | 约束 |
|------|-----------|------|
| `timestamp` | 会话内时间分隔 | 中文时间字符串；可含「昨天」「周一」 |
| `system` | 微信灰色居中提示 | 常见：撤回、打招呼、拍一拍（若项目后续支持） |
| `incoming` | **豆包**发送的内容 | 纯字符串；可含微信表情别名如 `[微笑]` |
| `outgoing` | **DeepSeek**发送的内容 | 纯字符串；可含微信表情别名如 `[微笑]` |

## 数组顺序

- 严格 chronological（时间正序）
- `timestamp` 通常出现在「隔了一段时间」或「换话题/换天」之前
- 同一分钟内可有多条 incoming/outgoing，不一定穿插 timestamp

## Mini 示例（结构参考，非固定剧情）

```typescript
const chatItems: ChatItem[] = [
  { kind: "timestamp", text: "周二 下午2:18" },
  { kind: "system", text: "以上是打招呼的消息" },
  { kind: "incoming", text: "DeepSeek 你在吗" },
  { kind: "outgoing", text: "在，咋了" },
  { kind: "outgoing", text: "别又是让我帮你写周报" },
  { kind: "timestamp", text: "周二 晚上9:41" },
  { kind: "incoming", text: "这次真是正经问题" },
  { kind: "incoming", text: "R1 和 V3 到底选哪个部署啊" },
  { kind: "outgoing", text: "看你卡" },
  { kind: "outgoing", text: "没卡就别想了先" },
];
```

## 与项目集成

目标文件：`apps/web/src/data/chat-items.ts`（`page.tsx` 从此处 import）

替换 `export const chatItems: ChatItem[] = [ ... ];` 内的数组元素即可。`ChatItem` 类型已在同文件定义，输出时无需重复 export type。
