import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { WechatChatPage } from "@/components/WechatChatPage";
import type { ChatItem } from "@/data/chat-items";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";
import { fetchChatItems } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";

const DEFAULT_TITLE = "豆包";

/**
 * 解析路由中的会话 ID。
 *
 * @param sessionId - 路由参数原始值
 * @returns 合法的正整数 ID；缺失或非法时返回 undefined
 */
function parseSessionId(sessionId: string | undefined): number | undefined {
  if (!sessionId) {
    return undefined;
  }

  const parsed = Number(sessionId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

/**
 * 截图页（独立路由，仅供截图脚本等工具直接访问）
 *
 * 负责从 API 或 iframe postMessage 获取聊天记录，并传给 WechatChatPage 渲染。
 * 应用内会话列表与发起会话应跳转至 ChatPage，而非本页。
 */
export function CapturePage() {
  const navigate = useNavigate();
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>();
  const sessionId = parseSessionId(sessionIdParam);
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

    fetchChatItems(sessionId)
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
  }, [preview.embedded, preview.received, preview.chatItems, sessionId]);

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
