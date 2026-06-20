import type { ChatItem } from "@/types/chat-item";
import type { NpcSummary } from "@/types/npc";

/**
 * 会话列表项，不含完整聊天记录。
 */
export interface SessionSummary {
  id: number;
  title: string;
  description: string | null;
  chat_item_count: number;
  peer_npc_ids: number[];
  self_npc_id: number | null;
  mobile_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 会话详情，包含完整聊天记录。
 */
export interface SessionDetail extends SessionSummary {
  chat_items: ChatItem[];
  peer_npcs: NpcSummary[];
  self_npc: NpcSummary | null;
}

/**
 * 创建或更新会话时的表单载荷。
 */
export interface SessionFormPayload {
  title: string;
  description: string | null;
  peer_npc_ids?: number[];
  self_npc_id?: number | null;
  chat_items?: ChatItem[];
}
