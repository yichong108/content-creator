import { WechatChatMessageList } from "@/components/WechatChatMessageList";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";

/**
 * 嵌入预览页（仅消息列表）
 *
 * 供 admin iframe 嵌入，通过 postMessage 接收聊天记录，
 * 只渲染 WechatChatMessageList，不含顶部导航与底部输入栏。
 */
export function WechatChatMessageListPage() {
  const preview = useChatPreviewPostMessage();

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <WechatChatMessageList
        chatItems={preview.received ? preview.chatItems : []}
        loading={!preview.received}
      />
    </main>
  );
}
