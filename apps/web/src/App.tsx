import { useEffect, useState } from "react";

import type { ChatItem } from "@/data/chat-items";
import { useChatPreviewPostMessage } from "@/hooks/useChatPreviewPostMessage";
import { fetchChatItems } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/request";

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
        <div className="wechat-bubble-in">{item.text}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-row-reverse items-start gap-[var(--wechat-avatar-gap)] py-1.5">
      <Avatar variant="self" />
      <div className="wechat-bubble-out">{item.text}</div>
    </div>
  );
}

/**
 * 微信聊天页主界面
 *
 * 挂载后从后端拉取 ChatItem 列表并渲染高仿微信会话 UI。
 */
export default function App() {
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

    // 防止组件卸载后，数据更新导致组件重新渲染
    let cancelled = false;

    fetchChatItems()
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

  const headerTitle = preview.embedded ? preview.title : "豆包";

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
        <h1 className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">
          {headerTitle}
        </h1>
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

      <section className="-mt-px min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(0.25rem+1px)] pt-[calc(0.25rem+1px)]">
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
