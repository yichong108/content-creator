import { useEffect, useRef, useState } from "react";

import type { ChatItem } from "@/data/chat-items";
import { fetchLiveChatItems, getLiveEventsUrl, type LiveSseMessagePayload } from "@/lib/api";
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

function parseSseMessagePayload(data: string): LiveSseMessagePayload | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
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
  } catch {
    return null;
  }
}

/**
 * 直播页聊天记录加载与 SSE 订阅 hook。
 *
 * 先通过 REST 拉取全量消息，再订阅 ``text/event-stream`` 接收新消息追加。
 *
 * @returns 标题、聊天记录、加载与错误状态
 */
export function useLiveChatStream() {
  const [title, setTitle] = useState("豆包");
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const liveSessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    const connectStream = () => {
      source = new EventSource(getLiveEventsUrl());

      source.addEventListener("connected", (event) => {
        try {
          const payload: unknown = JSON.parse((event as MessageEvent<string>).data);
          if (payload === null || typeof payload !== "object") {
            return;
          }

          const record = payload as Record<string, unknown>;
          if (typeof record.title === "string") {
            setTitle(record.title);
          }
          if (typeof record.live_session_id === "number") {
            liveSessionIdRef.current = record.live_session_id;
          }
        } catch {
          // 忽略 connected 解析失败
        }
      });

      source.addEventListener("message", (event) => {
        const payload = parseSseMessagePayload((event as MessageEvent<string>).data);
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
      });
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
      source?.close();
    };
  }, []);

  return { title, chatItems, loading, error };
}
