import type { ChatItem } from "@/types/chat-item";

export type { ChatItem } from "@/types/chat-item";

/**
 * 直播会话列表项，不含完整聊天记录。
 */
export interface LiveSessionSummary {
  id: number;
  title: string;
  description: string | null;
  chat_item_count: number;
  enabled: boolean;
  running: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 直播会话详情，包含完整聊天记录。
 */
export interface LiveSessionDetail extends LiveSessionSummary {
  chat_items: ChatItem[];
}

/**
 * 创建或更新直播会话时的表单载荷。
 */
export interface LiveSessionFormPayload {
  title: string;
  description: string | null;
  chat_items: ChatItem[];
}
