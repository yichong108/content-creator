import type { ChatItem } from "@/data/chat-items";

/** postMessage 协议标识，用于过滤无关消息 */
export const CHAT_PREVIEW_MESSAGE_SOURCE = "soulchat" as const;

/** 聊天记录预览 postMessage 事件类型 */
export const ChatPreviewMessageType = {
  /** iframe 内 web 页加载完成，可向父页面请求数据 */
  READY: "soulchat:chat-preview-ready",
  /** 父页面向 iframe 推送聊天记录 */
  DATA: "soulchat:chat-preview-data",
} as const;

/** 父页面推送给 iframe 的聊天记录载荷 */
export interface ChatPreviewDataPayload {
  chatItems: ChatItem[];
  /** 聊天页顶部标题，缺省为「豆包」 */
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
 * 构建向父页面发送的 ready 消息。
 *
 * @returns 可序列化的 postMessage 载荷
 */
export function createChatPreviewReadyMessage(): ChatPreviewMessage {
  return {
    source: CHAT_PREVIEW_MESSAGE_SOURCE,
    type: ChatPreviewMessageType.READY,
  };
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
