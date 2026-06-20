import { useState } from "react";

import { NpcAvatar } from "@/components/NpcAvatar";
import { WechatConfirmDialog } from "@/components/WechatConfirmDialog";
import { useLongPress } from "@/hooks/useLongPress";
import type { NpcSummary } from "@/types/npc";

export type WechatStartSessionPageProps = {
  /** 当前选中的对方 NPC 列表 */
  peerNpcs: NpcSummary[];
  /** 当前选中的己方 NPC */
  selfNpc: NpcSummary | null;
  /** 是否正在加载 */
  loading?: boolean;
  /** 加载失败时的错误文案 */
  error?: string | null;
  /** 是否正在创建会话 */
  submitting?: boolean;
  /** 创建失败时的错误文案 */
  submitError?: string | null;
  /** 确认移除对方 NPC 时的回调 */
  onRemovePeerNpc?: (npcId: number) => void;
  /** 确认移除己方 NPC 时的回调 */
  onRemoveSelfNpc?: () => void;
  /** 点击「对方」区域进入选择页 */
  onSelectPeer?: () => void;
  /** 点击「己方」区域进入选择页 */
  onSelectSelf?: () => void;
  /** 点击返回时的回调 */
  onBack?: () => void;
  /** 点击「开始聊天」时的回调 */
  onSubmit?: () => void;
};

/** 待确认移除的 NPC 信息 */
type RemoveConfirmTarget = {
  npc: NpcSummary;
  onConfirm: () => void;
};

type SelectedNpcItemProps = {
  npc: NpcSummary;
  disabled?: boolean;
  onLongPress?: () => void;
};

function SelectedNpcItem({ npc, disabled = false, onLongPress }: SelectedNpcItemProps) {
  const { pointerHandlers } = useLongPress(() => onLongPress?.(), {
    disabled: disabled || !onLongPress,
  });

  return (
    <div
      className="flex touch-manipulation select-none items-center gap-2.5 rounded-[4px] active:bg-black/[0.04]"
      {...pointerHandlers}
      aria-label={`${npc.name}，长按移除`}
    >
      <NpcAvatar name={npc.name} avatarUrl={npc.avatar_url} size={32} />
      <span className="text-[17px] leading-[1.3] text-[var(--wechat-text)]">{npc.name}</span>
    </div>
  );
}

type RoleSectionProps = {
  label: string;
  npcs: NpcSummary[];
  placeholder: string;
  onNavigate?: () => void;
  onRequestRemove?: (npc: NpcSummary) => void;
  disabled?: boolean;
};

function RoleSection({
  label,
  npcs,
  placeholder,
  onNavigate,
  onRequestRemove,
  disabled = false,
}: RoleSectionProps) {
  const hasSelection = npcs.length > 0;

  return (
    <div className="flex items-start gap-3 bg-[var(--wechat-surface)] px-4 py-3">
      <button
        type="button"
        className="w-14 shrink-0 pt-1 text-left text-[17px] text-[var(--wechat-text)] active:opacity-70 disabled:opacity-60"
        onClick={onNavigate}
        disabled={disabled}
      >
        {label}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 border-b-[0.5px] border-black/[0.06] pb-3">
        {hasSelection ? (
          npcs.map((npc) => (
            <SelectedNpcItem
              key={npc.id}
              npc={npc}
              disabled={disabled}
              onLongPress={onRequestRemove ? () => onRequestRemove(npc) : undefined}
            />
          ))
        ) : (
          <button
            type="button"
            className="text-left text-[17px] text-[var(--wechat-text-secondary)] active:opacity-70 disabled:opacity-60"
            onClick={onNavigate}
            disabled={disabled}
          >
            {placeholder}
          </button>
        )}
      </div>
      <button
        type="button"
        className="shrink-0 pt-0.5 text-[20px] leading-none text-[#c8c8c8] active:opacity-70 disabled:opacity-60"
        aria-label={`选择${label}`}
        onClick={onNavigate}
        disabled={disabled}
      >
        ›
      </button>
    </div>
  );
}

/**
 * 微信风格「发起会话」主页 UI
 *
 * 仅展示对方/己方及已选 NPC；点击进入子页选择，长按已选项弹出确认框后移除。
 */
export function WechatStartSessionPage({
  peerNpcs,
  selfNpc,
  loading = false,
  error = null,
  submitting = false,
  submitError = null,
  onRemovePeerNpc,
  onRemoveSelfNpc,
  onSelectPeer,
  onSelectSelf,
  onBack,
  onSubmit,
}: WechatStartSessionPageProps) {
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmTarget | null>(null);
  const canSubmit = peerNpcs.length > 0 || selfNpc != null;

  const openRemoveConfirm = (npc: NpcSummary, onConfirm: () => void) => {
    setRemoveConfirm({ npc, onConfirm });
  };

  const handleConfirmRemove = () => {
    removeConfirm?.onConfirm();
    setRemoveConfirm(null);
  };

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
            发起会话
          </h1>
          <span className="w-8" aria-hidden />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="py-8 text-center text-[14px] text-[var(--wechat-text-secondary)]">
            加载中…
          </p>
        )}
        {error && <p className="py-8 text-center text-[14px] text-red-500">{error}</p>}
        {!loading && !error && (
          <section className="mt-2">
            <RoleSection
              label="对方"
              npcs={peerNpcs}
              placeholder="请选择"
              disabled={submitting}
              onNavigate={onSelectPeer}
              onRequestRemove={
                onRemovePeerNpc
                  ? (npc) => openRemoveConfirm(npc, () => onRemovePeerNpc(npc.id))
                  : undefined
              }
            />
            <RoleSection
              label="己方"
              npcs={selfNpc ? [selfNpc] : []}
              placeholder="请选择"
              disabled={submitting}
              onNavigate={onSelectSelf}
              onRequestRemove={
                onRemoveSelfNpc
                  ? (npc) => openRemoveConfirm(npc, () => onRemoveSelfNpc())
                  : undefined
              }
            />
          </section>
        )}
      </div>

      <footer className="shrink-0 border-t-[0.5px] border-black/[0.05] bg-[var(--wechat-surface)] px-4 py-3">
        {submitError && <p className="mb-2 text-center text-[13px] text-red-500">{submitError}</p>}
        <button
          type="button"
          className="w-full rounded-[6px] bg-[#07c160] py-3 text-[17px] font-medium text-white active:bg-[#06ad56] disabled:opacity-50"
          disabled={!canSubmit || submitting || loading}
          onClick={onSubmit}
        >
          {submitting ? "创建中…" : "开始聊天"}
        </button>
      </footer>

      <WechatConfirmDialog
        open={removeConfirm != null}
        title={removeConfirm ? `确定移除「${removeConfirm.npc.name}」？` : ""}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveConfirm(null)}
      />
    </main>
  );
}
