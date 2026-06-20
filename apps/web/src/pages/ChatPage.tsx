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
