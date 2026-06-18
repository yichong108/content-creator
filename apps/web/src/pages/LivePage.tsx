import { useEffect, useState } from "react";

import { WechatChatPage } from "@/components/WechatChatPage";
import type { ChatItem } from "@/data/chat-items";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";
import { fetchLiveChatItems } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";

const DEFAULT_TITLE = "豆包";

/**
 * 直播页
 *
 * 负责从 API 或 iframe postMessage 获取聊天记录，并传给 WechatChatPage 渲染，供直播演示使用。
 */
export function LivePage() {
  const preview = useChatPreviewPostMessage();
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(!preview.embedded);
  const [error, setError] = useState<string | null>(null);

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

    fetchLiveChatItems()
      .then((res) => {
        if (cancelled) {
          return;
        }

        if (!res.ok) {
          setError(getRequestErrorMessage(res));
          return;
        }

        setChatItems(res.data ?? []);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [preview.embedded, preview.received, preview.chatItems]);

  const title = preview.embedded ? preview.title : DEFAULT_TITLE;

  return <WechatChatPage title={title} chatItems={chatItems} loading={loading} error={error} />;
}
