/**
 * 微信聊天项类型
 *
 * incoming = 豆包（字节跳动豆包 AI）
 * outgoing = DeepSeek（开源 DeepSeek AI）
 */
export type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | { kind: "incoming"; text: string }
  | { kind: "outgoing"; text: string };

/**
 * 会话列表项，不含完整聊天记录。
 */
export interface SessionSummary {
  id: number;
  title: string;
  description: string | null;
  chat_item_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 会话详情，包含完整聊天记录。
 */
export interface SessionDetail extends SessionSummary {
  chat_items: ChatItem[];
}

/**
 * 创建或更新会话时的表单载荷。
 */
export interface SessionFormPayload {
  title: string;
  description: string | null;
  chat_items: ChatItem[];
}
