import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { WechatChatMessageList } from "@/components/WechatChatMessageList";
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
 * 通过 WebSocket 拉取 running 会话的聊天记录，并用 WechatChatMessageList 渲染消息区域。
 */
export function ChatPage() {
  const navigate = useNavigate();
  const { sessionId: sessionIdParam } = useParams<{ sessionId?: string }>();
  const sessionId = parseSessionId(sessionIdParam);
  const live = useLiveChatStream(sessionId);
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    setDraft("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSend();
  };

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b-[0.5px] border-black/[0.05] px-3 pb-2.5 pt-3">
        <button
          type="button"
          className="-ml-1 flex h-8 w-8 items-center justify-center"
          aria-label="返回"
          onClick={() => navigate("/")}
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
          {live.title}
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

      <WechatChatMessageList
        chatItems={live.chatItems}
        loading={live.loading}
        error={live.error}
        peerTyping={live.peerTyping}
      />

      <footer className="shrink-0 border-t-[0.5px] border-black/[0.05] bg-[var(--wechat-composer-bg)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入消息"
            className="min-h-[36px] flex-1 rounded-[4px] border border-[var(--wechat-input-border)] bg-[var(--wechat-surface)] px-3 py-2 text-[16px] leading-[1.4] text-[var(--wechat-text)] outline-none focus:border-[#07c160]"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 rounded-[4px] bg-[#07c160] px-4 py-2 text-[15px] font-medium text-white active:bg-[#06ad56] disabled:opacity-40"
          >
            发送
          </button>
        </form>
      </footer>
    </main>
  );
}
