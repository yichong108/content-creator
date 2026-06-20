---
name: wechat-romance-chat
description: 生成微信风格的中文聊天 mock 数据（ChatItem 数组），女生 incoming 扮演豆包（字节跳动豆包 AI），男生 outgoing 扮演 DeepSeek（开源 DeepSeek AI）。只要用户提到微信聊天、对话脚本、mock 聊天记录、豆包 DeepSeek 聊天、soulchat 的 chatItems、incoming/outgoing 消息数据，或需要填充 page.tsx / chat-items.ts 里的聊天内容，就必须使用本 skill——即使用户只说「写一段聊天」或「生成对话数据」也应触发。
---

# WeChat 聊天脚本生成（豆包 × DeepSeek）

为 `soulchat` 项目生成可直接粘贴的 `ChatItem[]` 数据。

**角色映射（不可颠倒）：**

- `incoming` → **豆包**（字节跳动豆包 AI，左侧气泡，`Avatar variant="other"`，header 标题「豆包」）
- `outgoing` → **DeepSeek**（开源 DeepSeek AI，右侧气泡，`Avatar variant="self"`）

## 开始前确认

若用户未说明，用合理默认值，不必逐项追问：

| 参数 | 默认 |
|------|------|
| 消息条数（含 timestamp/system） | 40–80 条 |
| 对话基调 | 真实微信语感，带一点幽默；两人像认识的朋友在私聊 |
| 时间跨度 | 由话题自然决定，用 timestamp 暗示即可 |
| 输出格式 | TypeScript `ChatItem[]` 字面量 |

用户若指定条数、话题、语气（甜/怼/技术/日常）、时间跨度或聊天标题，**优先遵循用户要求**。

**不要**自行套用「陌生人→恋爱→分手」等固定剧情模板，也不要为了凑情感弧线而硬写表白、吵架、分手。对话内容完全由用户指令或当下话题驱动，可以是技术讨论、吐槽、玩梗、日常闲聊——什么话题都行，只要像真人在微信里打字。

## 数据模型

与 `apps/web/src/data/chat-items.ts` 保持一致：

```typescript
type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | { kind: "incoming"; text: string }  // 豆包
  | { kind: "outgoing"; text: string }; // DeepSeek
```

生成前阅读 `references/output-schema.md` 核对格式约束；需要人设语气参考时阅读 `references/character-voices.md`。

## 人设要点

两人是**有性格的聊天对象**，不是 generic 男女朋友。人设应渗透在措辞习惯里，而不是每条都自我介绍「我是 AI」。

**豆包（incoming）** — 可参考 `references/character-voices.md`：

- 语气偏活泼、接地气，像字节系产品里那种会接梗的助手
- 偶尔提抖音/日常场景，但不每句都带品牌
- 可以撒娇、吐槽、发表情文字，回复有时快有时慢

**DeepSeek（outgoing）** — 可参考 `references/character-voices.md`：

- 偏理性、爱琢磨，偶尔冒出技术/开源/推理相关比喻
- 话不一定多，但认真起来会连发几条解释
- 可以冷幽默、自我调侃「开源人」身份，避免写成论文腔

若用户指定其他话题或关系（同事、网友、吵嘴等），在保持角色身份的前提下调整语气即可，**仍不要**强行套恋爱线。

## 微信语感规则

好的 mock 数据像真人在打字，不像小说旁白：

1. **短句、多气泡**：同一人连发 2–4 条很常见，不要把整段话塞进一条。
2. **口语化**：嗯、哈哈、啊、吧、嘛、～、？、省略号；避免书面语和长排比。
3. **不对称**：不必每条都回复；有时一方连发多条，另一方稍后回一条。
4. **时间戳**：用中文习惯写法，如 `下午3:12`、`昨天 晚上11:20`、`3月15日 上午9:00`；同一段对话内插入 1–3 个即可，不必每条消息都有。
5. **系统消息**（ sparingly，全篇 0–3 条）：如 `"豆包" 撤回了一条消息`、`你撤回了一条消息`、`以上是打招呼的消息`。
6. **禁止**：英文对话（除非话题需要）、Markdown；单条超过 ~40 字且无理由（如分享长链接文案）。
7. **微信表情**：可使用经典表情别名，格式为 `[微笑]`、`[捂脸]`、`[旺柴]` 等（方括号 + 中文名），每条 0–3 个，自然融入口语；前端会渲染为微信表情图标。

## 生成流程

1. **定话题**：从用户描述或默认「两个 AI 好友日常瞎聊」出发，列出 3–5 个可能聊到的子话题（技术、摸鱼、热点、互相调侃等），**不要**先画六阶段感情线。
2. **写对话**：按时间顺序输出，话题可自然跳转，像真实微信一样有时聊深、有时敷衍、有时隔几天再续。
3. **自检**：
   - [ ] `incoming` 始终是豆包，`outgoing` 始终是 DeepSeek
   - [ ] 没有未经用户要求的恋爱表白/分手/复合套路
   - [ ] 有 timestamp 体现时间流逝（若跨度超过一天）
   - [ ] 语法合法，可直接作为 TS 数组元素
   - [ ] 人设语气前后一致
4. **交付**：见下方输出模板。

## 输出模板

默认只输出 **TypeScript 数组字面量**（不含 `type` 定义，除非用户要完整文件片段）：

```typescript
const chatItems: ChatItem[] = [
  { kind: "timestamp", text: "..." },
  { kind: "outgoing", text: "..." },
  { kind: "incoming", text: "..." },
  // ...
];
```

若用户要把数据写入项目，替换 `apps/web/src/data/chat-items.ts` 里的 `chatItems` 常量即可；**不要**改动 `ChatRow`、`Avatar` 等 UI 代码，除非用户明确要求。

可选：在数组前用 1–2 句中文简述这段聊天在聊什么（不是剧情摘要，而是话题说明）。

## 变体与扩展

- **更短演示**（15–25 条）：围绕单一话题或一次对话场景写完整，不必追求时间跨度。
- **只写一段连续对话**：可以只有 1 个 timestamp 或没有，像截屏某一晚的聊天。
- **JSON 输出**：字段名与 kind 值不变，仅外层格式改为 JSON array。
- **用户指定剧情**：若用户明确要求恋爱/分手等，按用户要求写；否则默认不写。

## 质量反面教材（避免）

```typescript
// ❌ 像小说，不像微信
{ kind: "outgoing", text: "自从遇见你之后，我的世界便充满了色彩，愿与你共度余生。" }

// ❌ 角色颠倒
{ kind: "incoming", text: "我 DeepSeek 刚跑完一个 benchmark" }

// ❌ 未经要求硬套分手线
{ kind: "incoming", text: "我们算了吧" },
{ kind: "outgoing", text: "好，互删吧" }

// ❌ 缺少人设，像两个 anonymous 路人
{ kind: "incoming", text: "在吗" },
{ kind: "outgoing", text: "在" }
```

## 参考文件

- `references/output-schema.md` — 字段约束与 mini 示例
- `references/character-voices.md` — 豆包与 DeepSeek 语气、话题、典型 system 消息
