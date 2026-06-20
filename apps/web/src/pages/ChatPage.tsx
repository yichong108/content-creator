import { useNavigate, useParams } from "react-router-dom";

import { WechatChatPage } from "@/components/WechatChatPage";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";
import { useLiveChatStream } from "@/hooks/useLiveChatStream";

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
 * 聊天页
 *
 * 负责从 API 或 iframe postMessage 获取聊天记录，并传给 WechatChatPage 渲染。
 * 非嵌入模式下通过 WebSocket 接收 running 会话的新消息追加。
 */
export function ChatPage() {
  const navigate = useNavigate();
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>();
  const sessionId = parseSessionId(sessionIdParam);
  const preview = useChatPreviewPostMessage();
  const live = useLiveChatStream(sessionId);

  if (preview.embedded) {
    const title = preview.received ? preview.title : "豆包";
    const loading = !preview.received;
    const chatItems = preview.received ? preview.chatItems : [];
    const error = null;

    return <WechatChatPage title={title} chatItems={chatItems} loading={loading} error={error} />;
  }

  return (
    <WechatChatPage
      title={live.title}
      chatItems={live.chatItems}
      loading={live.loading}
      error={live.error}
      peerTyping={live.peerTyping}
      onBack={() => navigate("/")}
    />
  );
}
