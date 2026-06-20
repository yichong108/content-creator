import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatItem } from "@/data/chat-items";
import {
  fetchLiveChatItems,
  getLiveWebSocketUrl,
  updateLiveSessionRunning,
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

const DEFAULT_TITLE = "会话";

/**
 * 格式化聊天页顶部标题为「会话(N)」，N 为参与会话的 NPC 数量。
 *
 * @param _title - 会话标题（ChatPage 顶部不展示，保留参数供调用方传入）
 * @param npcCount - 参与会话的 NPC 数量
 * @returns 展示用标题
 */
export function formatChatPageTitle(_title: string, npcCount: number): string {
  if (npcCount <= 0) {
    return "会话";
  }

  return `会话(${npcCount})`;
}

/**
 * 直播页聊天记录加载与 WebSocket 订阅 hook。
 *
 * 先通过 REST 拉取全量消息，再订阅 WebSocket 接收新消息追加。
 *
 * @param sessionId - 可选会话 ID；缺省时使用后端默认的已开启直播会话
 * @returns 标题、NPC 数量、聊天记录、运行状态、加载与错误状态，以及对方是否正在输入
 */
export function useLiveChatStream(sessionId?: number) {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [npcCount, setNpcCount] = useState(0);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [runningSubmitting, setRunningSubmitting] = useState(false);
  const sessionIdRef = useRef<number | null>(sessionId ?? null);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;

    sessionIdRef.current = sessionId ?? null;
    setTitle(DEFAULT_TITLE);
    setNpcCount(0);
    setChatItems([]);
    setRunning(false);
    setLoading(true);
    setError(null);
    setPeerTyping(false);
    setRunningSubmitting(false);

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
            const connectedSessionId =
              typeof record.live_session_id === "number" ? record.live_session_id : null;

            if (sessionId == null && connectedSessionId != null) {
              sessionIdRef.current = connectedSessionId;
            }

            if (
              typeof record.title === "string" &&
              (sessionId == null || connectedSessionId === sessionId)
            ) {
              setTitle(record.title);
            }
            if (typeof record.running === "boolean") {
              setRunning(record.running);
            }
            return;
          }
          case "message": {
            const payload = parseWsMessagePayload(frame.data);
            if (!payload) {
              return;
            }

            if (sessionIdRef.current != null && payload.live_session_id !== sessionIdRef.current) {
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

            if (sessionIdRef.current != null && payload.live_session_id !== sessionIdRef.current) {
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
            if (typeof record.running === "boolean") {
              setRunning(record.running);
            }
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

    void fetchLiveChatItems(sessionId).then((res) => {
      if (cancelled) {
        return;
      }

      if (!res.ok) {
        setError(getRequestErrorMessage(res));
        setLoading(false);
        return;
      }

      setChatItems(res.data.items);
      setTitle(res.data.title);
      setNpcCount(res.data.npc_count);
      setRunning(res.data.running);
      setLoading(false);
      setError(null);
      connectStream();
    });

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [sessionId]);

  /**
   * 切换当前会话的运行状态（开始/停止实时续写）。
   *
   * @param nextRunning - 目标运行状态
   * @returns 是否更新成功
   */
  const setSessionRunning = useCallback(
    async (nextRunning: boolean): Promise<boolean> => {
      const targetSessionId = sessionIdRef.current ?? sessionId;
      if (targetSessionId == null) {
        setError("无法识别当前会话");
        return false;
      }

      setRunningSubmitting(true);
      const result = await updateLiveSessionRunning(targetSessionId, nextRunning);
      setRunningSubmitting(false);

      if (!result.ok) {
        setError(getRequestErrorMessage(result));
        return false;
      }

      setRunning(result.data.running);
      setError(null);
      return true;
    },
    [sessionId],
  );

  return {
    title,
    npcCount,
    chatItems,
    running,
    loading,
    error,
    peerTyping,
    runningSubmitting,
    setSessionRunning,
  };
}
