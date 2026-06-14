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
