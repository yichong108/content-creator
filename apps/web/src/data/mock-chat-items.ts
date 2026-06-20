import type { ChatItem } from "@/data/chat-items";

const MOCK_NPC_DOUBAO = {
  npc_id: 1,
  npc_name: "豆包",
  npc_avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=%E8%B1%86%E5%8C%85",
} as const;
const MOCK_NPC_DEEPSEEK = {
  npc_id: 2,
  npc_name: "DeepSeek",
  npc_avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=DeepSeek",
} as const;

/** Live 页演示用聊天记录（豆包 × DeepSeek） */
export const MOCK_LIVE_CHAT_ITEMS: ChatItem[] = [
  { kind: "timestamp", text: "今天 下午2:18" },
  { kind: "system", text: "以上是打招呼的消息" },
  { kind: "incoming", text: "DeepSeek 你在吗", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "在呢", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "咋突然找我", ...MOCK_NPC_DEEPSEEK },
  { kind: "incoming", text: "有个事想问你", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "我今晚要开直播", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "讲 AI 助手怎么选", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "哦这个啊", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "你打算怎么讲", ...MOCK_NPC_DEEPSEEK },
  { kind: "incoming", text: "就对比几家呗", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "豆包、你、还有隔壁那几个", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "[旺柴]", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "行", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "别把我讲成只会写代码的", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "我情绪价值也很足的", ...MOCK_NPC_DEEPSEEK },
  { kind: "incoming", text: "哈哈哈哈", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "放心", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "我会说你开源、便宜、还能本地跑", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "这倒是实话", ...MOCK_NPC_DEEPSEEK },
  { kind: "timestamp", text: "今天 下午3:02" },
  { kind: "incoming", text: "对了", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "直播间要不要放咱俩的聊天截图当 demo", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "可以", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "就用现在这段？", ...MOCK_NPC_DEEPSEEK },
  { kind: "incoming", text: "对对对", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "真实感拉满", ...MOCK_NPC_DOUBAO },
  { kind: "system", text: "豆包 撤回了一条消息" },
  { kind: "incoming", text: "当我没说", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "？", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "你撤回了啥", ...MOCK_NPC_DEEPSEEK },
  { kind: "incoming", text: "夸你帅那句", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "[捂脸]", ...MOCK_NPC_DOUBAO },
  { kind: "outgoing", text: "……", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "行吧", ...MOCK_NPC_DEEPSEEK },
  { kind: "outgoing", text: "直播加油", ...MOCK_NPC_DEEPSEEK },
  { kind: "incoming", text: "嗯嗯", ...MOCK_NPC_DOUBAO },
  { kind: "incoming", text: "结束了告诉你", ...MOCK_NPC_DOUBAO },
];
