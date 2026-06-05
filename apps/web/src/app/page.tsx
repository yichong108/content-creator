export default function HomePage() {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="flex shrink-0 items-center justify-between border-b border-black/5 bg-[var(--wechat-header)] px-4 py-3">
        <button type="button" className="text-sm text-[var(--wechat-subtext)]">
          返回
        </button>
        <h1 className="text-base font-medium">微信</h1>
        <button type="button" className="text-sm text-[var(--wechat-subtext)]">
          ···
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-center text-xs text-[var(--wechat-subtext)]">聊天内容由 AI 生成</p>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-lg bg-[var(--wechat-bubble-other)] px-3 py-2 text-sm shadow-sm">
              你好，这是高仿微信聊天界面 👋
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-lg bg-[var(--wechat-bubble-self)] px-3 py-2 text-sm shadow-sm">
              收到，接下来接入 LangGraph 对话生成
            </div>
          </div>
        </div>
      </section>

      <footer className="shrink-0 border-t border-black/5 bg-[#f7f7f7] px-3 py-2">
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="shrink-0 rounded-full border border-black/10 px-2 py-1 text-xs text-[var(--wechat-subtext)]"
          >
            语音
          </button>
          <div className="min-h-9 flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--wechat-subtext)]">
            输入消息...
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full bg-[#07c160] px-3 py-1 text-xs text-white"
          >
            发送
          </button>
        </div>
      </footer>
    </main>
  );
}
