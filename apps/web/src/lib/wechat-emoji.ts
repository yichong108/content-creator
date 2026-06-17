import type { CSSProperties } from "react";
import { emojiMap, type WechatEmoji } from "wechat-emoji-renderer";

/** 雪碧图总宽度（px） */
const SPRITE_WIDTH = 500;

/** 雪碧图总高度（px） */
const SPRITE_HEIGHT = 720;

/** 雪碧图列数 */
const SPRITE_COLS = 9;

/** 雪碧图行数 */
const SPRITE_ROWS = 12;

/** 雪碧图中单格宽度（px） */
const CELL_WIDTH = SPRITE_WIDTH / SPRITE_COLS;

/** 雪碧图中单格高度（px） */
const CELL_HEIGHT = SPRITE_HEIGHT / SPRITE_ROWS;

/** 雪碧图在 public 目录下的访问路径 */
export const WECHAT_EMOJI_SPRITE_URL = "/wechat-emoji-sprite.png";

/** 气泡正文字号（px），与 index.css `font-size` 一致 */
export const WECHAT_CHAT_FONT_SIZE = 17;

/** 气泡行高倍数，与 index.css `line-height` 一致 */
export const WECHAT_CHAT_LINE_HEIGHT_RATIO = 1.4;

/**
 * 表情布局盒边长（px）。
 * 与 index.css `--wechat-emoji-size` 保持一致。
 */
export const WECHAT_EMOJI_DISPLAY_SIZE = 22;

/**
 * 雪碧图单格内表情主体占格子的较短边比例。
 * 用于裁掉格内留白，让图案贴满 22px 布局盒。
 */
const CELL_CONTENT_RATIO = 0.62;

export type WechatMessageSegment =
  | { type: "text"; value: string }
  | { type: "emoji"; value: string; emoji: WechatEmoji };

export type WechatEmojiRenderStyles = {
  /** 外层裁切容器，固定为展示尺寸 */
  wrapper: CSSProperties;
  /** 内层雪碧图切片，通过 background 定位裁切，避免 transform 亚像素模糊 */
  inner: CSSProperties;
};

/**
 * 读取当前设备像素比；SSR 环境返回 1。
 */
function getDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  return window.devicePixelRatio || 1;
}

/**
 * 将长度对齐到设备物理像素网格，减轻亚像素渲染模糊。
 *
 * @param value - 逻辑像素长度
 * @param dpr - 设备像素比，默认取当前窗口值
 */
function snapToDevicePixel(value: number, dpr = getDevicePixelRatio()): number {
  return Math.round(value * dpr) / dpr;
}

/**
 * 将展示尺寸对齐到设备像素比，减轻亚像素缩放导致的模糊。
 *
 * @param size - 逻辑像素边长
 * @returns 对齐后的边长；SSR 环境原样返回
 */
export function snapEmojiSizeToDevicePixel(size: number): number {
  if (typeof window === "undefined") {
    return size;
  }

  return snapToDevicePixel(size);
}

/**
 * 将聊天文本拆分为普通文字与微信表情片段。
 *
 * 识别 `[微笑]` 等方括号别名；未知别名保留为原文，避免误伤系统消息中的方括号。
 *
 * @param text - 原始聊天文本
 * @returns 按出现顺序排列的片段列表
 */
export function parseWechatMessageText(text: string): WechatMessageSegment[] {
  const segments: WechatMessageSegment[] = [];
  const pattern = /\[([^\]]+)\]/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;

    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const code = match[0];
    const emoji = emojiMap.get(code);

    if (emoji) {
      segments.push({ type: "emoji", value: code, emoji });
    } else {
      segments.push({ type: "text", value: code });
    }

    lastIndex = start + code.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * 计算微信表情双层 DOM 结构所需的样式。
 *
 * 通过 background-size / background-position 裁切雪碧图，所有像素值对齐设备网格，
 * 避免 transform: scale 带来的亚像素模糊。
 *
 * @param position - 表情在雪碧图中的 `[行, 列]` 坐标（1 起始）
 * @param displaySize - 行内展示边长（px）
 * @returns 外层裁切容器与内层雪碧图元素的样式
 */
export function getWechatEmojiRenderStyles(
  position: [number, number],
  displaySize = WECHAT_EMOJI_DISPLAY_SIZE,
): WechatEmojiRenderStyles {
  const [row, col] = position;
  const colIndex = col - 1;
  const rowIndex = row - 1;
  const size = displaySize;
  const coverScale = Math.max(
    size / (CELL_WIDTH * CELL_CONTENT_RATIO),
    size / (CELL_HEIGHT * CELL_CONTENT_RATIO),
  );
  const bgWidth = snapToDevicePixel(SPRITE_WIDTH * coverScale);
  const bgHeight = snapToDevicePixel(SPRITE_HEIGHT * coverScale);
  const scaledCellWidth = CELL_WIDTH * coverScale;
  const scaledCellHeight = CELL_HEIGHT * coverScale;
  const bgX = snapToDevicePixel(-colIndex * scaledCellWidth + (size - scaledCellWidth) / 2);
  const bgY = snapToDevicePixel(-rowIndex * scaledCellHeight + (size - scaledCellHeight) / 2);

  return {
    wrapper: {
      display: "inline-block",
      overflow: "hidden",
      position: "relative",
      flexShrink: 0,
    },
    inner: {
      position: "absolute",
      inset: 0,
      backgroundImage: `url(${WECHAT_EMOJI_SPRITE_URL})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${bgWidth}px ${bgHeight}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
    },
  };
}
