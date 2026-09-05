import { Link } from "react-router-dom";

type HomeEntry = {
  path: string;
  label: string;
  description: string;
};

const ENTRIES: HomeEntry[] = [
  { path: "/sessions", label: "会话列表", description: "微信风格聊天会话" },
  { path: "/capturePage", label: "截图页", description: "聊天截图预览" },
  { path: "/customer-service", label: "客服", description: "移动端客服入口" },
];

/**
 * 应用首页导航
 *
 * 聚合主要功能入口，点击卡片跳转到对应页面。
 */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-[var(--wechat-bg)] px-4 py-8">
      <h1 className="mb-6 text-center text-[20px] font-medium leading-[1.3] text-[var(--wechat-text)]">
        ContentCreator
      </h1>

      <div className="flex flex-col gap-3">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.path}
            to={entry.path}
            className="flex items-center justify-between rounded-[6px] bg-[var(--wechat-surface)] px-4 py-4 active:bg-black/[0.03]"
          >
            <div>
              <p className="text-[17px] font-medium leading-[1.3] text-[var(--wechat-text)]">
                {entry.label}
              </p>
              <p className="mt-1 text-[13px] leading-[1.3] text-[var(--wechat-text-secondary)]">
                {entry.description}
              </p>
            </div>
            <span className="shrink-0 text-[var(--wechat-text-secondary)]" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
