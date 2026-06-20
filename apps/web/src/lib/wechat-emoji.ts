import { emojiMap, type WechatEmoji } from "wechat-emoji-renderer";

/** 独立表情 PNG 在 public 目录下的访问前缀 */
export const WECHAT_EMOJI_IMAGE_BASE_URL = "/wechat-emoji";

/** 气泡正文字号（px），与 index.css `font-size` 一致 */
export const WECHAT_CHAT_FONT_SIZE = 17;

/** 气泡行高倍数，与 index.css `line-height` 一致 */
export const WECHAT_CHAT_LINE_HEIGHT_RATIO = 1.4;

/**
 * 表情布局盒边长（px，逻辑尺寸）。
 * 与 index.css `--wechat-emoji-size` 保持一致。
 */
export const WECHAT_EMOJI_DISPLAY_SIZE = 24;

/**
 * 表情 PNG 相对展示尺寸的像素倍率。
 * 资源由 `scripts/split-wechat-emoji-sprite.mjs` 按此倍率导出（@2x）。
 */
export const WECHAT_EMOJI_PIXEL_RATIO = 2;

/** 表情 PNG 较长边目标尺寸（px） */
export const WECHAT_EMOJI_ASSET_SIZE = WECHAT_EMOJI_DISPLAY_SIZE * WECHAT_EMOJI_PIXEL_RATIO;

export type WechatMessageSegment =
  | { type: "text"; value: string }
  | { type: "emoji"; value: string; emoji: WechatEmoji };

/**
 * 根据表情名称生成独立 PNG 的 URL。
 *
 * 图片由 `scripts/split-wechat-emoji-sprite.mjs` 导出：优先 wechat-emojis 高清源，
 * `scripts/assets/wechat-emoji-overrides/` 可放置缺失表情（如「冷汗」）的补图。
 *
 * @param name - 表情中文名或别名（如 `微笑`、`OK`）
 * @returns public 目录下的访问路径
 */
export function getWechatEmojiImageUrl(name: string): string {
  return `${WECHAT_EMOJI_IMAGE_BASE_URL}/${encodeURIComponent(name)}.png`;
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
