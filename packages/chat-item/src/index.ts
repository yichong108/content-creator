/** 微信聊天项 kind 枚举值 */
export const CHAT_ITEM_KINDS = ["timestamp", "system", "incoming", "outgoing"] as const;

/** 微信聊天项 kind 类型 */
export type ChatItemKind = (typeof CHAT_ITEM_KINDS)[number];

/**
 * 微信聊天项类型（普通会话与直播会话共用）
 *
 * incoming = 豆包（字节跳动豆包 AI）
 * outgoing = DeepSeek（开源 DeepSeek AI）
 */
export type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | { kind: "incoming"; text: string }
  | { kind: "outgoing"; text: string };
