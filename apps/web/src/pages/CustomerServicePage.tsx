import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { WechatChatMessageList } from "@/components/WechatChatMessageList";
import type { ChatItem } from "@/data/chat-items";

/** 客服欢迎消息（页面首次加载时展示） */
const INITIAL_CHAT_ITEMS: ChatItem[] = [
  {
    kind: "incoming",
    npc_id: 1,
    npc_name: "客服小助手",
    npc_avatar_url: "/avatar-other.png",
    text: "您好，请问有什么可以帮您？",
  },
];

/** 发送者（用户自身）的 NPC 信息 */
const SELF_NPC_INFO = {
  npc_id: 0,
  npc_name: "我",
  npc_avatar_url: "/avatar-self.png",
};

/**
 * 客服入口页面
 *
 * 移动端客服聊天页，包含顶部导航、消息列表与底部输入栏。
 * 当前使用本地 state 管理消息，后续接入客服 API 时替换为数据流。
 */
export function CustomerServicePage() {
  const navigate = useNavigate();
  const [chatItems, setChatItems] = useState<ChatItem[]>(INITIAL_CHAT_ITEMS);
  const [draft, setDraft] = useState("");

  /** 将草稿内容作为 outgoing 消息追加到列表末尾 */
  const handleSend = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    setChatItems((prev) => [
      ...prev,
      {
        kind: "outgoing",
        ...SELF_NPC_INFO,
        text,
      },
    ]);
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
        <h1 className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">客服</h1>
        <span className="h-8 w-8" aria-hidden />
      </header>

      <WechatChatMessageList chatItems={chatItems} avatarVariant="circle" />

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
