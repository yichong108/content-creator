/**
 * 微信聊天项类型
 *
 * incoming = 豆包（字节跳动豆包 AI）
 * outgoing = DeepSeek（开源 DeepSeek AI）
 */
export type LiveChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | { kind: "incoming"; text: string }
  | { kind: "outgoing"; text: string };

/**
 * 直播会话列表项，不含完整聊天记录。
 */
export interface LiveSessionSummary {
  id: number;
  title: string;
  description: string | null;
  chat_item_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 直播会话详情，包含完整聊天记录。
 */
export interface LiveSessionDetail extends LiveSessionSummary {
  chat_items: LiveChatItem[];
}

/**
 * 创建或更新直播会话时的表单载荷。
 */
export interface LiveSessionFormPayload {
  title: string;
  description: string | null;
  chat_items: LiveChatItem[];
}
