import { WechatChatPage } from "@/components/WechatChatPage";
import { MOCK_LIVE_CHAT_ITEMS } from "@/data/mock-chat-items";

const LIVE_CHAT_TITLE = "豆包";

/**
 * 直播页
 *
 * 使用本地模拟聊天记录渲染微信聊天 UI，供直播演示或预览。
 */
export function LivePage() {
  return (
    <WechatChatPage title={LIVE_CHAT_TITLE} chatItems={MOCK_LIVE_CHAT_ITEMS} loading={false} />
  );
}
