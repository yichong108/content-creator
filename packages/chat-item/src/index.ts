/** 微信聊天项 kind 枚举值 */
export const CHAT_ITEM_KINDS = ["timestamp", "system", "incoming", "outgoing"] as const;

/** 微信聊天项 kind 类型 */
export type ChatItemKind = (typeof CHAT_ITEM_KINDS)[number];

/**
 * 聊天消息绑定的 NPC 元数据
 *
 * incoming / outgoing 消息必须携带，用于标识发言角色与展示头像。
 */
export type ChatItemNpcInfo = {
  /** 发言 NPC ID */
  npc_id: number;
  /** 发言 NPC 名称（冗余字段，便于展示与调试） */
  npc_name: string;
  /** 发言 NPC 头像 URL（绝对路径或相对 API 路径） */
  npc_avatar_url: string;
};

/**
 * 微信聊天项类型（普通会话与直播会话共用）
 *
 * incoming = 非己方（对方侧）消息
 * outgoing = 己方发送的消息
 */
export type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | ({ kind: "incoming"; text: string } & ChatItemNpcInfo)
  | ({ kind: "outgoing"; text: string } & ChatItemNpcInfo);
