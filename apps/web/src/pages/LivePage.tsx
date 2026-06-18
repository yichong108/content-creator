import { WechatChatPage } from "@/components/WechatChatPage";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";
import { useLiveChatStream } from "@/hooks/useLiveChatStream";

/**
 * 直播页
 *
 * 负责从 API 或 iframe postMessage 获取聊天记录，并传给 WechatChatPage 渲染，供直播演示使用。
 * 非嵌入模式下通过 SSE 接收 running 会话的新消息追加。
 */
export function LivePage() {
  const preview = useChatPreviewPostMessage();
  const live = useLiveChatStream();

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
    />
  );
}
