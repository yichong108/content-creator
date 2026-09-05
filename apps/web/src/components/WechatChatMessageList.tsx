import { useEffect, useRef } from "react";

import { WechatMessageText } from "@/components/WechatMessageText";
import type { ChatItem } from "@/data/chat-items";
import { resolveChatItemAvatarUrl } from "@/lib/chat-item-avatar";

export type WechatChatMessageListProps = {
  /** 待渲染的聊天记录列表 */
  chatItems: ChatItem[];
  /** 是否处于加载中 */
  loading?: boolean;
  /** 加载失败时的错误文案，为 null 表示无错误 */
  error?: string | null;
  /** 对方是否正在输入（仅展示 incoming 侧） */
  peerTyping?: boolean;
  /** 附加到滚动容器的 className */
  className?: string;
  /** 头像渲染样式：image=图片（默认），circle=纯色圆占位符 */
  avatarVariant?: "image" | "circle";
};

/**
 * 消息头像渲染
 *
 * 根据 avatarVariant 决定是渲染 img 还是纯色圆占位符。
 * 客服等场景使用 circle 模式避免引入额外图片资源。
 */
function MessageAvatar({
  src,
  alt,
  variant = "image",
}: {
  src: string;
  alt: string;
  variant?: "image" | "circle";
}) {
  if (variant === "circle") {
    return (
      <div
        role="img"
        aria-label={alt}
        className="h-[calc(18px+17px*1.4)] w-[calc(18px+17px*1.4)] shrink-0 rounded-full bg-[#d8d8d8]"
      />
    );
  }

  const size = Math.round(18 + 17 * 1.4);

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

/**
 * 头像加载失败时的占位头像
 *
 * 与 MessageAvatar 接受相同的 variant 参数，保持渲染一致性。
 */
function FallbackAvatar({
  variant,
  avatarVariant = "image",
}: {
  variant: "self" | "other";
  avatarVariant?: "image" | "circle";
}) {
  const src = variant === "self" ? "/avatar-self.png" : "/avatar-other.png";
  const alt = variant === "self" ? "我的头像" : "对方头像";
  return <MessageAvatar src={src} alt={alt} variant={avatarVariant} />;
}

/**
 * 单条聊天记录行
 *
 * 根据 item.kind 渲染不同布局；avatarVariant 透传给 MessageAvatar。
 */
function ChatRow({
  item,
  avatarVariant = "image",
}: {
  item: ChatItem;
  avatarVariant?: "image" | "circle";
}) {
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
        <MessageAvatar
          src={resolveChatItemAvatarUrl(item.npc_avatar_url)}
          alt={`${item.npc_name} 头像`}
          variant={avatarVariant}
        />
        <div className="wechat-bubble-in">
          <WechatMessageText text={item.text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row-reverse items-start gap-[var(--wechat-avatar-gap)] py-1.5">
      <MessageAvatar
        src={resolveChatItemAvatarUrl(item.npc_avatar_url)}
        alt={`${item.npc_name} 头像`}
        variant={avatarVariant}
      />
      <div className="wechat-bubble-out">
        <WechatMessageText text={item.text} />
      </div>
    </div>
  );
}

/** 对方正在输入状态的占位行 */
function PeerTypingRow({ avatarVariant = "image" }: { avatarVariant?: "image" | "circle" }) {
  return (
    <div className="flex items-start gap-[var(--wechat-avatar-gap)] py-1.5" aria-live="polite">
      <FallbackAvatar variant="other" avatarVariant={avatarVariant} />
      <div className="wechat-bubble-in wechat-typing-bubble">
        <span className="wechat-typing-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className="sr-only">对方正在输入</span>
      </div>
    </div>
  );
}

/**
 * 微信聊天记录列表
 *
 * 仅包含可滚动的消息区域，不含聊天页顶部导航与底部输入栏；
 * 由调用方传入聊天记录及加载/错误状态。
 */
export function WechatChatMessageList({
  chatItems,
  loading = false,
  error = null,
  peerTyping = false,
  className,
  avatarVariant = "image",
}: WechatChatMessageListProps) {
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = scrollRef.current;
    if (!section || loading || error) {
      return;
    }
    section.scrollTop = section.scrollHeight;
  }, [chatItems, loading, error, peerTyping]);

  return (
    <section
      ref={scrollRef}
      className={
        className ??
        "-mt-px min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(0.25rem+1px)] pt-[calc(0.25rem+1px)]"
      }
    >
      {loading && (
        <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">加载中…</p>
      )}
      {error && <p className="py-8 text-center text-[14px] text-red-500">{error}</p>}
      {!loading &&
        !error &&
        chatItems.map((item, index) => (
          <ChatRow key={`${item.kind}-${index}`} item={item} avatarVariant={avatarVariant} />
        ))}
      {!loading && !error && peerTyping && <PeerTypingRow avatarVariant={avatarVariant} />}
    </section>
  );
}
