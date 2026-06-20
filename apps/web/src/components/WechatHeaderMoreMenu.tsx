import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type WechatHeaderMoreMenuItem = {
  /** 菜单项唯一标识 */
  key: string;
  /** 菜单项展示文案 */
  label: string;
  /** 点击菜单项时的回调 */
  onClick: () => void;
};

export type WechatHeaderMoreMenuProps = {
  /** 触发「更多」按钮的 aria-label */
  triggerAriaLabel?: string;
  /** 气泡菜单选项列表 */
  items: WechatHeaderMoreMenuItem[];
  /** 自定义触发按钮内容；未提供时使用默认三点图标 */
  trigger?: ReactNode;
};

/**
 * 微信风格导航栏「更多」气泡菜单
 *
 * 点击触发按钮后在右上角展示深色气泡选项，点击外部区域或选项后关闭。
 * 使用原生定位与事件处理，避免引入与 React 19 兼容性不佳的 Popover 组件库。
 */
export function WechatHeaderMoreMenu({
  triggerAriaLabel = "更多",
  items,
  trigger,
}: WechatHeaderMoreMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleItemClick = (item: WechatHeaderMoreMenuItem) => {
    setOpen(false);
    item.onClick();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center"
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger ?? (
          <img
            src="/more-icon.png"
            alt=""
            width={16}
            height={3}
            className="block h-1 w-auto"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="更多操作"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[132px] rounded-[6px] bg-[#4c4c4c] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.18)]"
        >
          <span
            className="absolute -top-[5px] right-3 h-2.5 w-2.5 rotate-45 rounded-[1px] bg-[#4c4c4c]"
            aria-hidden
          />
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`block w-full px-4 py-2.5 text-left text-[15px] leading-none text-white active:bg-white/10 ${
                index > 0 ? "border-t border-white/10" : ""
              }`}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
