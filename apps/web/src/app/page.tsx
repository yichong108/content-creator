import Image from "next/image";

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
    return (
      <p className="py-2 text-center text-[12px] leading-[1.2] text-[var(--wechat-text-secondary)]">
        {item.text}
      </p>
    );
  }

  if (item.kind === "system") {
    return (
      <p className="py-2 text-center text-[12px] leading-[1.2] text-[var(--wechat-text-secondary)]">
        {item.text}
      </p>
    );
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
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b-[0.5px] border-black/[0.05] px-3 pb-2.5 pt-3">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center"
          aria-label="返回"
        >
          <Image
            src="/back-arrow.png"
            alt=""
            width={10}
            height={18}
            className="block h-[18px] w-auto"
            aria-hidden
          />
        </button>
        <h1 className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">
          对方正在输入中
        </h1>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center"
          aria-label="更多"
        >
          <Image
            src="/more-icon.png"
            alt=""
            width={16}
            height={3}
            className="block h-1 w-auto"
            aria-hidden
          />
        </button>
      </header>

      <section className="-mt-px min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-[calc(0.25rem+1px)]">
        {chatItems.map((item, index) => (
          <ChatRow key={`${item.kind}-${index}`} item={item} />
        ))}
      </section>

      <footer className="shrink-0">
        <Image
          src="/chat-footer.png"
          alt="聊天输入栏"
          width={999}
          height={257}
          className="block h-auto w-full"
          priority
        />
      </footer>
    </main>
  );
}
