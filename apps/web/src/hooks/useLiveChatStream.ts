import { useEffect, useRef, useState } from "react";

import type { ChatItem } from "@/data/chat-items";
import {
  fetchLiveChatItems,
  getLiveWebSocketUrl,
  type LiveWsFrame,
  type LiveWsMessagePayload,
  type LiveWsTypingPayload,
} from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";

function isChatItem(value: unknown): value is ChatItem {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.kind === "string" &&
    typeof record.text === "string" &&
    (record.kind === "timestamp" ||
      record.kind === "system" ||
      record.kind === "incoming" ||
      record.kind === "outgoing")
  );
}

function parseWsMessagePayload(data: unknown): LiveWsMessagePayload | null {
  if (data === null || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (
    typeof record.live_session_id !== "number" ||
    typeof record.total !== "number" ||
    typeof record.index !== "number" ||
    !isChatItem(record.item)
  ) {
    return null;
  }

  return {
    live_session_id: record.live_session_id,
    item: record.item,
    total: record.total,
    index: record.index,
  };
}

function parseWsTypingPayload(data: unknown): LiveWsTypingPayload | null {
  if (data === null || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (
    typeof record.live_session_id !== "number" ||
    typeof record.typing !== "boolean" ||
    (record.speaker !== "incoming" && record.speaker !== "outgoing")
  ) {
    return null;
  }

  return {
    live_session_id: record.live_session_id,
    typing: record.typing,
    speaker: record.speaker,
  };
}

function parseWsFrame(raw: string): LiveWsFrame | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.event !== "string") {
      return null;
    }

    return {
      event: record.event,
      data: record.data,
    };
  } catch {
    return null;
  }
}

/**
 * 直播页聊天记录加载与 WebSocket 订阅 hook。
 *
 * 先通过 REST 拉取全量消息，再订阅 WebSocket 接收新消息追加。
 *
 * @returns 标题、聊天记录、加载与错误状态，以及对方是否正在输入
 */
export function useLiveChatStream() {
  const [title, setTitle] = useState("豆包");
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const liveSessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    const connectStream = () => {
      socket = new WebSocket(getLiveWebSocketUrl());

      socket.onmessage = (event) => {
        const frame = parseWsFrame(String(event.data));
        if (!frame) {
          return;
        }

        switch (frame.event) {
          case "connected": {
            const data = frame.data;
            if (data === null || typeof data !== "object") {
              return;
            }

            const record = data as Record<string, unknown>;
            if (typeof record.title === "string") {
              setTitle(record.title);
            }
            if (typeof record.live_session_id === "number") {
              liveSessionIdRef.current = record.live_session_id;
            }
            return;
          }
          case "message": {
            const payload = parseWsMessagePayload(frame.data);
            if (!payload) {
              return;
            }

            if (
              liveSessionIdRef.current != null &&
              payload.live_session_id !== liveSessionIdRef.current
            ) {
              return;
            }

            setChatItems((prev) => {
              if (prev.length >= payload.total) {
                return prev;
              }
              return [...prev, payload.item];
            });
            setPeerTyping(false);
            return;
          }
          case "typing": {
            const payload = parseWsTypingPayload(frame.data);
            if (!payload) {
              return;
            }

            if (
              liveSessionIdRef.current != null &&
              payload.live_session_id !== liveSessionIdRef.current
            ) {
              return;
            }

            setPeerTyping(payload.typing && payload.speaker === "incoming");
            return;
          }
          case "status": {
            const data = frame.data;
            if (data === null || typeof data !== "object") {
              return;
            }

            const record = data as Record<string, unknown>;
            if (record.running === false) {
              setPeerTyping(false);
            }
            return;
          }
          default:
            return;
        }
      };
    };

    void fetchLiveChatItems().then((res) => {
      if (cancelled) {
        return;
      }

      if (!res.ok) {
        setError(getRequestErrorMessage(res));
        setLoading(false);
        return;
      }

      setChatItems(res.data.items);
      setLoading(false);
      setError(null);
      connectStream();
    });

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  return { title, chatItems, loading, error, peerTyping };
}
