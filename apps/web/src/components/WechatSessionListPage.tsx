import { Link } from "react-router-dom";

import { resolveChatItemAvatarUrl } from "@/lib/chat-item-avatar";
import { formatWechatSessionTime, truncateSessionPreview } from "@/lib/format-wechat-time";
import type { MobileSessionSummary } from "@/types/mobile-session";

export type WechatSessionListPageProps = {
  /** 会话列表数据 */
  sessions: MobileSessionSummary[];
  /** 是否处于加载中 */
  loading?: boolean;
  /** 加载失败时的错误文案，为 null 表示无错误 */
  error?: string | null;
};

function SessionAvatar({ session }: { session: MobileSessionSummary }) {
  const avatarUrl = session.peer_avatar_url
    ? resolveChatItemAvatarUrl(session.peer_avatar_url)
    : "/avatar-other.png";

  return (
    <img
      src={avatarUrl}
      alt={`${session.title} 头像`}
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-[4px] object-cover"
    />
  );
}

function SessionRow({ session }: { session: MobileSessionSummary }) {
  const preview = session.last_message ? truncateSessionPreview(session.last_message) : "暂无消息";

  return (
    <Link
      to={`/chatPage/${session.id}`}
      className="flex items-center gap-3 bg-[var(--wechat-surface)] px-4 py-3 active:bg-black/[0.03]"
    >
      <SessionAvatar session={session} />
      <div className="min-w-0 flex-1 border-b-[0.5px] border-black/[0.06] pb-3">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[17px] leading-[1.3] text-[var(--wechat-text)]">
            {session.title}
          </p>
          <span className="shrink-0 pt-0.5 text-[12px] leading-none text-[var(--wechat-text-secondary)]">
            {formatWechatSessionTime(session.updated_at)}
          </span>
        </div>
        <p className="mt-1 truncate text-[14px] leading-[1.3] text-[var(--wechat-text-secondary)]">
          {preview}
        </p>
      </div>
    </Link>
  );
}

/**
 * 微信会话列表页 UI
 *
 * 纯展示组件，不包含数据拉取逻辑；由调用方传入会话列表及加载/错误状态。
 */
export function WechatSessionListPage({
  sessions,
  loading = false,
  error = null,
}: WechatSessionListPageProps) {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="relative z-10 shrink-0 border-b-[0.5px] border-black/[0.05] bg-[var(--wechat-bg)] px-4 pb-2.5 pt-3">
        <div className="flex items-center justify-between">
          <span className="w-8" aria-hidden />
          <h1 className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">
            聊天会话
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
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">
            加载中…
          </p>
        )}
        {error && <p className="py-8 text-center text-[14px] text-red-500">{error}</p>}
        {!loading && !error && sessions.length === 0 && (
          <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">
            暂无会话
          </p>
        )}
        {!loading &&
          !error &&
          sessions.map((session) => <SessionRow key={session.id} session={session} />)}
      </section>
    </main>
  );
}
