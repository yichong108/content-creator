import type { ChatItem } from "@/types/chat-item";

/** postMessage 协议标识，用于过滤无关消息 */
export const CHAT_PREVIEW_MESSAGE_SOURCE = "contentcreator" as const;

/** 聊天记录预览 postMessage 事件类型 */
export const ChatPreviewMessageType = {
  READY: "contentcreator:chat-preview-ready",
  DATA: "contentcreator:chat-preview-data",
} as const;

/** 父页面推送给 iframe 的聊天记录载荷 */
export interface ChatPreviewDataPayload {
  chatItems: ChatItem[];
  title?: string;
}

/** 聊天记录预览 postMessage 消息体 */
export interface ChatPreviewMessage {
  source: typeof CHAT_PREVIEW_MESSAGE_SOURCE;
  type: (typeof ChatPreviewMessageType)[keyof typeof ChatPreviewMessageType];
  payload?: ChatPreviewDataPayload;
}

/**
 * 判断 event.data 是否为合法的聊天记录预览消息。
 *
 * @param data - postMessage 的 data 字段
 * @returns 类型收窄后的消息对象，非法时返回 null
 */
export function parseChatPreviewMessage(data: unknown): ChatPreviewMessage | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const message = data as Partial<ChatPreviewMessage>;
  if (message.source !== CHAT_PREVIEW_MESSAGE_SOURCE || typeof message.type !== "string") {
    return null;
  }

  if (
    message.type !== ChatPreviewMessageType.READY &&
    message.type !== ChatPreviewMessageType.DATA
  ) {
    return null;
  }

  return message as ChatPreviewMessage;
}

/**
 * 构建向 iframe 推送聊天记录的消息。
 *
 * @param payload - 聊天记录与可选标题
 * @returns 可序列化的 postMessage 载荷
 */
export function createChatPreviewDataMessage(payload: ChatPreviewDataPayload): ChatPreviewMessage {
  return {
    source: CHAT_PREVIEW_MESSAGE_SOURCE,
    type: ChatPreviewMessageType.DATA,
    payload,
  };
}

/**
 * 获取 web 预览页地址，用于 iframe src。
 *
 * @param path - 预览页路径，默认为 /chatMessageListPage
 * @returns web 应用完整 URL
 */
export function getWebPreviewUrl(path = "/chatMessageListPage"): string {
  const base = import.meta.env.VITE_WEB_PREVIEW_URL ?? "http://localhost:3001";
  return new URL(path, base.endsWith("/") ? base : `${base}/`).href;
}

/**
 * 从 web 预览 URL 解析 postMessage 目标 origin。
 *
 * @returns iframe contentWindow 的 targetOrigin
 */
export function getWebPreviewOrigin(): string {
  return new URL(getWebPreviewUrl()).origin;
}
