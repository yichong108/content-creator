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
| `incoming` | 女生发送的内容 | 纯字符串，无 kind 嵌套 |
| `outgoing` | 男生发送的内容 | 纯字符串，无 kind 嵌套 |

## 数组顺序

- 严格 chronological（时间正序）
- `timestamp` 通常出现在「隔了一段时间」或「换话题/换天」之前
- 同一分钟内可有多条 incoming/outgoing，不一定穿插 timestamp

## Mini 示例（结构参考，非完整剧情）

```typescript
const chatItems: ChatItem[] = [
  { kind: "timestamp", text: "周二 下午2:18" },
  { kind: "system", text: "以上是打招呼的消息" },
  { kind: "incoming", text: "你好呀，我是群聊里加你的那个" },
  { kind: "outgoing", text: "哦哦记得" },
  { kind: "outgoing", text: "你好你好" },
  { kind: "timestamp", text: "周二 晚上9:41" },
  { kind: "incoming", text: "今天加班吗" },
  { kind: "outgoing", text: "刚下班" },
  { kind: "outgoing", text: "你呢" },
];
```

## 与 page.tsx 集成

目标文件：`apps/web/src/app/page.tsx`

替换 `const chatItems: ChatItem[] = [ ... ];` 内的数组元素即可。`ChatItem` 类型已在同文件定义，输出时无需重复 export type。
