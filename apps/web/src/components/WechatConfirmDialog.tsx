import { useEffect, useId } from "react";

export type WechatConfirmDialogProps = {
  /** 是否展示对话框 */
  open: boolean;
  /** 标题文案 */
  title: string;
  /** 确认按钮文案 */
  confirmLabel?: string;
  /** 取消按钮文案 */
  cancelLabel?: string;
  /** 点击确认 */
  onConfirm: () => void;
  /** 点击取消或遮罩 */
  onCancel: () => void;
};

/**
 * 微信风格确认对话框
 *
 * 居中展示标题与取消/确认按钮，用于长按移除等需二次确认的操作。
 */
export function WechatConfirmDialog({
  open,
  title,
  confirmLabel = "确定",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: WechatConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="关闭对话框"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[280px] overflow-hidden rounded-[12px] bg-[var(--wechat-surface)]"
      >
        <p
          id={titleId}
          className="px-5 py-6 text-center text-[17px] leading-[1.4] text-[var(--wechat-text)]"
        >
          {title}
        </p>
        <div className="flex border-t-[0.5px] border-black/[0.08]">
          <button
            type="button"
            className="flex-1 py-3.5 text-[17px] text-[var(--wechat-text)] active:bg-black/[0.04]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="flex-1 border-l-[0.5px] border-black/[0.08] py-3.5 text-[17px] font-medium text-[#576b95] active:bg-black/[0.04]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
