type ChatItem =
  | { kind: "timestamp"; text: string }
  | { kind: "system"; text: string }
  | { kind: "incoming"; text: string }
  | { kind: "outgoing"; text: string };

const chatItems: ChatItem[] = [
  { kind: "timestamp", text: "晚上10:45" },
  { kind: "outgoing", text: "今天下班有点晚，路上注意安全" },
  { kind: "timestamp", text: "晚上10:48" },
  { kind: "incoming", text: "好呀，我已经到家了" },
  { kind: "incoming", text: "你那边还顺利吗？" },
  { kind: "system", text: "“对方正在输入中” 撤回了一条消息" },
  { kind: "incoming", text: "周末要不要一起去看展？" },
  { kind: "outgoing", text: "可以啊，我看看时间" },
  { kind: "outgoing", text: "到时候提前跟你说" },
];

function ChevronLeftIcon() {
  return (
    <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden>
      <path
        d="M9 1L1 9L9 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="22" height="6" viewBox="0 0 22 6" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="2.5" />
      <circle cx="11" cy="3" r="2.5" />
      <circle cx="19" cy="3" r="2.5" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="12" stroke="#191919" strokeWidth="1.2" />
      <path
        d="M9 11.5C9 9.567 10.567 8 12.5 8H13.5C15.433 8 17 9.567 17 11.5V14.5C17 16.433 15.433 18 13.5 18H12.5C10.567 18 9 16.433 9 14.5V11.5Z"
        stroke="#191919"
        strokeWidth="1.2"
      />
      <path d="M13 18V20" stroke="#191919" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 20H15.5" stroke="#191919" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12" stroke="#191919" strokeWidth="1.2" />
      <circle cx="10" cy="12" r="1.2" fill="#191919" />
      <circle cx="18" cy="12" r="1.2" fill="#191919" />
      <path
        d="M10 17.5C11.2 19.2 12.5 20 14 20C15.5 20 16.8 19.2 18 17.5"
        stroke="#191919"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="12" stroke="#191919" strokeWidth="1.2" />
      <path d="M14 9V19" stroke="#191919" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 14H19" stroke="#191919" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function Avatar({ variant }: { variant: "self" | "other" }) {
  if (variant === "self") {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#f0e6d8] text-lg"
        aria-hidden
      >
        🐑
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#d8dce3] text-lg"
      aria-hidden
    >
      👤
    </div>
  );
}

function ChatRow({ item }: { item: ChatItem }) {
  if (item.kind === "timestamp") {
    return <p className="py-2 text-center text-xs text-[var(--wechat-subtext)]">{item.text}</p>;
  }

  if (item.kind === "system") {
    return <p className="py-2 text-center text-xs text-[var(--wechat-subtext)]">{item.text}</p>;
  }

  if (item.kind === "incoming") {
    return (
      <div className="flex items-start gap-2.5 py-1.5">
        <Avatar variant="other" />
        <div className="wechat-bubble-in max-w-[calc(100%-3.25rem)]">{item.text}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-row-reverse items-start gap-2.5 py-1.5">
      <Avatar variant="self" />
      <div className="wechat-bubble-out max-w-[calc(100%-3.25rem)]">{item.text}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="flex shrink-0 items-center justify-between bg-[var(--wechat-header)] px-3 pb-2.5 pt-3">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-[#191919]"
          aria-label="返回"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-[17px] font-medium tracking-tight">对方正在输入中</h1>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-[#191919]"
          aria-label="更多"
        >
          <MoreIcon />
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {chatItems.map((item, index) => (
          <ChatRow key={`${item.kind}-${index}`} item={item} />
        ))}
      </section>

      <footer className="shrink-0 border-t border-black/[0.06] bg-white px-2.5 py-2">
        <div className="flex items-end gap-2">
          <button type="button" className="mb-0.5 shrink-0" aria-label="语音">
            <VoiceIcon />
          </button>
          <div className="min-h-[38px] flex-1 rounded-[6px] border border-[var(--wechat-input-border)] bg-white px-3 py-2 text-[16px] leading-snug text-[var(--wechat-subtext)]">
            输入消息...
          </div>
          <button type="button" className="mb-0.5 shrink-0" aria-label="表情">
            <EmojiIcon />
          </button>
          <button type="button" className="mb-0.5 shrink-0" aria-label="更多功能">
            <PlusIcon />
          </button>
        </div>
      </footer>
    </main>
  );
}
