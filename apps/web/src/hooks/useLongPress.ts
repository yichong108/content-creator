import { useCallback, useRef } from "react";

/** 长按手势配置 */
export type UseLongPressOptions = {
  /** 触发长按的按住时长（毫秒） */
  delay?: number;
  /** 是否禁用 */
  disabled?: boolean;
};

/**
 * 绑定长按手势，用于移动端长按移除等交互。
 *
 * @param onLongPress - 长按触发时的回调
 * @param options - 延迟与禁用配置
 * @returns 可 spread 到目标元素的 pointer 事件处理器
 */
export function useLongPress(onLongPress: () => void, options: UseLongPressOptions = {}) {
  const { delay = 500, disabled = false } = options;
  const timerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pointerHandlers = {
    onPointerDown: (event: React.PointerEvent) => {
      if (disabled) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      triggeredRef.current = false;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        triggeredRef.current = true;
        onLongPress();
      }, delay);
    },
    onPointerUp: clearTimer,
    onPointerLeave: clearTimer,
    onPointerCancel: clearTimer,
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
    },
  };

  return { pointerHandlers, triggeredRef };
}
