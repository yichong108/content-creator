import { useEffect, useState } from "react";

import type { ChatItem } from "@/data/chat-items";
import {
  ChatPreviewMessageType,
  createChatPreviewReadyMessage,
  parseChatPreviewMessage,
} from "@/lib/chat-preview-message";

interface ChatPreviewState {
  /** 是否处于 iframe 嵌入预览模式 */
  embedded: boolean;
  /** 父页面是否已推送聊天记录 */
  received: boolean;
  /** 预览聊天记录 */
  chatItems: ChatItem[];
  /** 聊天页标题 */
  title: string;
}

const DEFAULT_TITLE = "豆包";

/**
 * 解析允许接收 postMessage 的父页面来源。
 *
 * 开发环境默认允许 admin（3002）；生产可通过 VITE_PREVIEW_PARENT_ORIGINS 配置。
 *
 * @returns 允许的 origin 列表
 */
function getAllowedParentOrigins(): string[] {
  const configured = import.meta.env.VITE_PREVIEW_PARENT_ORIGINS;
  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return ["http://localhost:3002", "http://127.0.0.1:3002"];
}

/**
 * 判断当前页面是否被嵌入 iframe 中。
 *
 * @returns 嵌入时为 true
 */
function isEmbeddedInIframe(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

/**
 * 在 iframe 嵌入模式下通过 postMessage 接收聊天记录。
 *
 * 独立访问 web 页时不启用该逻辑，由调用方继续走 API 拉取。
 *
 * @returns 嵌入状态、是否已收到数据、聊天项与标题
 */
export function useChatPreviewPostMessage(): ChatPreviewState {
  const [embedded] = useState(isEmbeddedInIframe);
  const [received, setReceived] = useState(false);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [title, setTitle] = useState(DEFAULT_TITLE);

  useEffect(() => {
    if (!embedded) {
      return;
    }

    const allowedOrigins = getAllowedParentOrigins();

    const handleMessage = (event: MessageEvent) => {
      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      const message = parseChatPreviewMessage(event.data);
      if (message?.type !== ChatPreviewMessageType.DATA || !message.payload) {
        return;
      }

      setChatItems(message.payload.chatItems);
      setTitle(message.payload.title?.trim() || DEFAULT_TITLE);
      setReceived(true);
    };

    window.addEventListener("message", handleMessage);

    for (const origin of allowedOrigins) {
      window.parent.postMessage(createChatPreviewReadyMessage(), origin);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [embedded]);

  return { embedded, received, chatItems, title };
}
