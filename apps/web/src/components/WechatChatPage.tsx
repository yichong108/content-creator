import { useEffect, useRef } from "react";

import { WechatMessageText } from "@/components/WechatMessageText";
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
};

function Avatar({ variant }: { variant: "self" | "other" }) {
  const size = Math.round(18 + 17 * 1.4);
  const src = variant === "self" ? "/avatar-self.png" : "/avatar-other.png";
  const alt = variant === "self" ? "我的头像" : "对方头像";

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="h-[calc(18px+17px*1.4)] w-[calc(18px+17px*1.4)] shrink-0 rounded-[4px] object-cover"
    />
  );
}

function ChatRow({ item }: { item: ChatItem }) {
  if (item.kind === "timestamp") {
    return (
      <p className="pb-4 pt-[calc(1rem+5px)] text-center text-[12px] leading-[1.2] text-[var(--wechat-text-secondary)]">
        {item.text}
      </p>
    );
  }

  if (item.kind === "system") {
    return (
      <p className="py-2.5 text-center text-[14px] leading-[1.2] text-[var(--wechat-text-secondary)]">
        {item.text}
      </p>
    );
  }

  if (item.kind === "incoming") {
    return (
      <div className="flex items-start gap-[var(--wechat-avatar-gap)] py-1.5">
        <Avatar variant="other" />
        <div className="wechat-bubble-in">
          <WechatMessageText text={item.text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row-reverse items-start gap-[var(--wechat-avatar-gap)] py-1.5">
      <Avatar variant="self" />
      <div className="wechat-bubble-out">
        <WechatMessageText text={item.text} />
      </div>
    </div>
  );
}

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
}: WechatChatPageProps) {
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = scrollRef.current;
    if (!section || loading || error) {
      return;
    }
    section.scrollTop = section.scrollHeight;
  }, [chatItems, loading, error]);

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b-[0.5px] border-black/[0.05] px-3 pb-2.5 pt-3">
        <button
          type="button"
          className="-ml-1 flex h-8 w-8 items-center justify-center"
          aria-label="返回"
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

      <section
        ref={scrollRef}
        className="-mt-px min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(0.25rem+1px)] pt-[calc(0.25rem+1px)]"
      >
        {loading && (
          <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">
            加载中…
          </p>
        )}
        {error && <p className="py-8 text-center text-[14px] text-red-500">{error}</p>}
        {!loading &&
          !error &&
          chatItems.map((item, index) => <ChatRow key={`${item.kind}-${index}`} item={item} />)}
      </section>

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
