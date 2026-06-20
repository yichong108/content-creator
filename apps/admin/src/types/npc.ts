/**
 * NPC 列表项。
 */
import type { ChatItem } from "@/types/chat-item";

export interface NpcSummary {
  id: number;
  /** NPC 名称 */
  name: string;
  /** 人设描述 */
  persona_description: string;
  /** 标签列表 */
  tags: string[];
  /** 头像 URL */
  avatar_url: string | null;
  /** NPC 聊天记录 */
  chat_items: ChatItem[];
  /** 聊天记录条数 */
  chat_item_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 创建或更新 NPC 时的表单载荷。
 */
export interface NpcFormPayload {
  name: string;
  persona_description: string;
  tags: string[];
  avatar_url?: string | null;
}

/** NPC 表单提交时的附加选项。 */
export interface NpcFormOptions {
  /** 待上传的头像文件 */
  avatarFile?: File | null;
}
