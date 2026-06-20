import { WechatChatMessageList } from "@/components/WechatChatMessageList";
import type { ChatItem } from "@/data/chat-items";

export type WechatChatPageProps = {
  /** 聊天页顶部标题（对方昵称） */
  title: string;
  /** 待渲染的聊天记录列表 */
  chatItems: ChatItem[];
  /** 是否处于加载中 */
  loading?: boolean;
  /** 加载失败时的错误文案，为 null 表示无错误 */
  error?: string | null;
  /** 对方是否正在输入（仅展示 incoming 侧） */
  peerTyping?: boolean;
  /** 点击返回按钮时的回调；未提供时不绑定点击事件 */
  onBack?: () => void;
};

/**
 * 微信聊天页完整 UI
 *
 * 纯展示组件，不包含数据拉取逻辑；由调用方传入标题、聊天记录及加载/错误状态。
 */
export function WechatChatPage({
  title,
  chatItems,
  loading = false,
  error = null,
  peerTyping = false,
  onBack,
}: WechatChatPageProps) {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b-[0.5px] border-black/[0.05] px-3 pb-2.5 pt-3">
        <button
          type="button"
          className="-ml-1 flex h-8 w-8 items-center justify-center"
          aria-label="返回"
          onClick={onBack}
        >
          <img
            src="/back-arrow.png"
            alt=""
            width={10}
            height={18}
            className="block h-[18px] w-auto"
            aria-hidden
          />
        </button>
        <h1 className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">{title}</h1>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center"
          aria-label="更多"
        >
          <img
            src="/more-icon.png"
            alt=""
            width={16}
            height={3}
            className="block h-1 w-auto"
            aria-hidden
          />
        </button>
      </header>

      <WechatChatMessageList
        chatItems={chatItems}
        loading={loading}
        error={error}
        peerTyping={peerTyping}
      />

      <footer className="shrink-0">
        <img
          src="/chat-input-bar.png"
          alt="聊天输入栏"
          width={1024}
          height={145}
          className="block h-auto w-full"
        />
      </footer>
    </main>
  );
}
