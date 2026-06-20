import { NpcAvatar } from "@/components/NpcAvatar";
import type { NpcSummary } from "@/types/npc";

export type WechatNpcSelectPageProps = {
  /** 页面标题，如「选择对方」 */
  title: string;
  /** 可选 NPC 列表 */
  npcs: NpcSummary[];
  /** 是否正在加载 */
  loading?: boolean;
  /** 加载失败时的错误文案 */
  error?: string | null;
  /** 是否为多选模式 */
  multiple?: boolean;
  /** 当前选中的 NPC ID 列表 */
  selectedIds: number[];
  /** 点击 NPC 行时的回调（单选为选中，多选为切换） */
  onSelect: (npcId: number) => void;
  /** 点击返回时的回调 */
  onBack?: () => void;
  /** 多选模式下点击「完成」时的回调 */
  onDone?: () => void;
};

type NpcRowProps = {
  npc: NpcSummary;
  checked: boolean;
  multiple: boolean;
  onSelect: () => void;
};

function NpcRow({ npc, checked, multiple, onSelect }: NpcRowProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 bg-[var(--wechat-surface)] px-4 py-3 text-left active:bg-black/[0.03]"
      onClick={onSelect}
    >
      <NpcAvatar name={npc.name} avatarUrl={npc.avatar_url} />
      <div className="min-w-0 flex-1 border-b-[0.5px] border-black/[0.06] pb-3">
        <p className="truncate text-[17px] leading-[1.3] text-[var(--wechat-text)]">{npc.name}</p>
        {npc.tags.length > 0 && (
          <p className="mt-0.5 truncate text-[13px] leading-[1.3] text-[var(--wechat-text-secondary)]">
            {npc.tags.join(" · ")}
          </p>
        )}
      </div>
      {multiple ? (
        <span
          className={`mb-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${
            checked ? "border-[#07c160] bg-[#07c160]" : "border-[#c8c8c8] bg-white"
          }`}
          aria-hidden
        >
          {checked && (
            <svg viewBox="0 0 12 10" className="h-2.5 w-3 text-white" fill="none" aria-hidden>
              <path
                d="M1 5.2L4.4 8.6L11 1.4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      ) : (
        <span
          className={`mb-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            checked ? "border-[#07c160] bg-[#07c160]" : "border-[#c8c8c8] bg-white"
          }`}
          aria-hidden
        >
          {checked && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      )}
    </button>
  );
}

/**
 * 微信风格 NPC 选择页 UI
 *
 * 支持单选（己方）与多选（对方）；多选时通过底部「完成」确认并返回。
 */
export function WechatNpcSelectPage({
  title,
  npcs,
  loading = false,
  error = null,
  multiple = false,
  selectedIds,
  onSelect,
  onBack,
  onDone,
}: WechatNpcSelectPageProps) {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--wechat-bg)]">
      <header className="relative z-10 shrink-0 border-b-[0.5px] border-black/[0.05] bg-[var(--wechat-bg)] px-3 pb-2.5 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="-ml-1 flex h-8 w-8 items-center justify-center"
            aria-label="返回"
            onClick={onBack}
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
            {title}
          </h1>
          {multiple ? (
            <button
              type="button"
              className="text-[17px] text-[#576b95] active:opacity-70"
              onClick={onDone}
            >
              完成
            </button>
          ) : (
            <span className="w-8" aria-hidden />
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">
            加载中…
          </p>
        )}
        {error && <p className="py-8 text-center text-[14px] text-red-500">{error}</p>}
        {!loading && !error && npcs.length === 0 && (
          <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">
            暂无可选 NPC
          </p>
        )}
        {!loading &&
          !error &&
          npcs.map((npc) => (
            <NpcRow
              key={npc.id}
              npc={npc}
              multiple={multiple}
              checked={selectedIds.includes(npc.id)}
              onSelect={() => onSelect(npc.id)}
            />
          ))}
      </div>
    </main>
  );
}
