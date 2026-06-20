import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { WechatChatPage } from "@/components/WechatChatPage";
import type { ChatItem } from "@/data/chat-items";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";
import { fetchChatItems } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";

const DEFAULT_TITLE = "豆包";

/**
 * 解析路由中的直播会话 ID。
 *
 * @param liveSessionId - 路由参数原始值
 * @returns 合法的正整数 ID；缺失或非法时返回 undefined
 */
function parseLiveSessionId(liveSessionId: string | undefined): number | undefined {
  if (!liveSessionId) {
    return undefined;
  }

  const parsed = Number(liveSessionId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

/**
 * 微信聊天页
 *
 * 负责从 API 或 iframe postMessage 获取聊天记录，并传给 WechatChatPage 渲染。
 */
export function ChatPage() {
  const navigate = useNavigate();
  const { liveSessionId: liveSessionIdParam } = useParams<{ liveSessionId?: string }>();
  const liveSessionId = parseLiveSessionId(liveSessionIdParam);
  const preview = useChatPreviewPostMessage();
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(!preview.embedded);
  const [error, setError] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);

  useEffect(() => {
    if (preview.embedded) {
      if (preview.received) {
        setChatItems(preview.chatItems);
        setLoading(false);
        setError(null);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSessionTitle(null);

    fetchChatItems(liveSessionId)
      .then((res) => {
        if (cancelled) {
          return;
        }

        if (!res.ok) {
          setError(getRequestErrorMessage(res));
          setChatItems([]);
          return;
        }

        setChatItems(res.data ?? []);
        const incoming = (res.data ?? []).find((item) => item.kind === "incoming");
        setSessionTitle(incoming?.npc_name ?? DEFAULT_TITLE);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preview.embedded, preview.received, preview.chatItems, liveSessionId]);

  const title = preview.embedded ? preview.title : (sessionTitle ?? DEFAULT_TITLE);
  const handleBack = preview.embedded ? undefined : () => navigate("/");

  return (
    <WechatChatPage
      title={title}
      chatItems={chatItems}
      loading={loading}
      error={error}
      onBack={handleBack}
    />
  );
}
