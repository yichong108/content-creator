import type { ChatItem } from "@/types/chat-item";
import type { NpcSummary } from "@/types/npc";

export type { ChatItem } from "@/types/chat-item";

/**
 * 直播会话列表项，不含完整聊天记录。
 */
export interface LiveSessionSummary {
  id: number;
  title: string;
  description: string | null;
  chat_item_count: number;
  peer_npc_ids: number[];
  self_npc_id: number | null;
  enabled: boolean;
  mobile_enabled: boolean;
  running: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 直播会话详情，包含完整聊天记录。
 */
export interface LiveSessionDetail extends LiveSessionSummary {
  chat_items: ChatItem[];
  peer_npcs: NpcSummary[];
  self_npc: NpcSummary | null;
}

/**
 * 创建或更新直播会话时的表单载荷。
 */
export interface LiveSessionFormPayload {
  title: string;
  description: string | null;
  peer_npc_ids?: number[];
  self_npc_id?: number | null;
  chat_items?: ChatItem[];
}
