/**
 * 导出微信表情独立 PNG（@2x）。
 *
 * 优先级：scripts/assets/wechat-emoji-overrides → wechat-emojis → 雪碧图兜底。
 *
 * 输出目录：apps/web/public/wechat-emoji/{表情名}.png
 */
import { createRequire } from "node:module";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getEmojiInfo } from "wechat-emojis";
import { wechatEmojis } from "wechat-emoji-renderer";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const spritePath = path.join(webRoot, "public", "wechat-emoji-sprite.png");
const outputDir = path.join(webRoot, "public", "wechat-emoji");
const overridesDir = path.join(__dirname, "assets", "wechat-emoji-overrides");
const hdEmojiRoot = path.dirname(require.resolve("wechat-emojis/package.json"));

/** 雪碧图列数，与 wechat-emoji-renderer 一致 */
const SPRITE_COLS = 9;

/** 雪碧图行数，与 wechat-emoji-renderer 一致 */
const SPRITE_ROWS = 12;

/** 气泡内表情展示边长（px），与 index.css `--wechat-emoji-size` 一致 */
const EMOJI_DISPLAY_SIZE = 24;

/** 表情 PNG 相对展示尺寸的像素倍率（2 即 @2x 图） */
const EMOJI_PIXEL_RATIO = 2;

/** 导出 PNG 的较长边目标尺寸（px） */
const EMOJI_ASSET_SIZE = EMOJI_DISPLAY_SIZE * EMOJI_PIXEL_RATIO;

/**
 * 判断 override 高清图源是否存在。
 *
 * @param name - 表情名称
 * @returns 本地 override PNG 路径；不存在时返回 null
 */
async function getEmojiOverridePath(name) {
  const overridePath = path.join(overridesDir, `${name}.png`);

  try {
    await access(overridePath);
    return overridePath;
  } catch {
    return null;
  }
}

/**
 * 将高清图源缩放至 @2x 导出尺寸（仅缩小，避免放大导致模糊）。
 *
 * @param sourcePath - 源 PNG 路径
 * @returns @2x PNG Buffer
 */
async function exportHdEmoji(sourcePath) {
  const source = sharp(sourcePath);
  const { width, height } = await source.metadata();

  if (!width || !height) {
    throw new Error(`无法读取表情图片: ${sourcePath}`);
  }

  if (width <= EMOJI_ASSET_SIZE && height <= EMOJI_ASSET_SIZE) {
    return source.png().toBuffer();
  }

  return source
    .resize(EMOJI_ASSET_SIZE, EMOJI_ASSET_SIZE, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

/**
 * 从雪碧图裁切单格并 trim；仅缩小至 @2x，不放大低分辨率像素。
 *
 * @param sprite - 雪碧图 sharp 实例
 * @param spriteWidth - 雪碧图宽度（px）
 * @param spriteHeight - 雪碧图高度（px）
 * @param position - `[行, 列]` 坐标（1 起始）
 * @returns PNG Buffer
 */
async function exportSpriteEmoji(sprite, spriteWidth, spriteHeight, position) {
  const [row, col] = position;
  const cellWidth = spriteWidth / SPRITE_COLS;
  const cellHeight = spriteHeight / SPRITE_ROWS;
  const left = Math.round((col - 1) * cellWidth);
  const top = Math.round((row - 1) * cellHeight);
  const width = Math.round(col * cellWidth) - left;
  const height = Math.round(row * cellHeight) - top;

  const cellBuffer = await sprite
    .clone()
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  const trimmed = sharp(await sharp(cellBuffer).trim({ threshold: 12 }).png().toBuffer());
  const { width: trimmedWidth, height: trimmedHeight } = await trimmed.metadata();

  if (!trimmedWidth || !trimmedHeight) {
    throw new Error(`雪碧图裁切失败: position=${position}`);
  }

  if (trimmedWidth <= EMOJI_ASSET_SIZE && trimmedHeight <= EMOJI_ASSET_SIZE) {
    return trimmed.png().toBuffer();
  }

  return trimmed
    .resize(EMOJI_ASSET_SIZE, EMOJI_ASSET_SIZE, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function main() {
  const sprite = sharp(spritePath);
  const { width: spriteWidth, height: spriteHeight } = await sprite.metadata();

  if (!spriteWidth || !spriteHeight) {
    throw new Error(`无法读取雪碧图尺寸: ${spritePath}`);
  }

  await mkdir(outputDir, { recursive: true });

  let written = 0;
  const spriteFallback = [];
  const overrideUsed = [];

  for (const emoji of wechatEmojis) {
    const overridePath = await getEmojiOverridePath(emoji.name);
    const hdInfo = getEmojiInfo(emoji.name);
    let png;

    if (overridePath) {
      png = await exportHdEmoji(overridePath);
      overrideUsed.push(emoji.name);
    } else if (hdInfo) {
      png = await exportHdEmoji(path.join(hdEmojiRoot, hdInfo.path));
    } else {
      png = await exportSpriteEmoji(sprite, spriteWidth, spriteHeight, emoji.position);
      spriteFallback.push(emoji.name);
    }

    await writeFile(path.join(outputDir, `${emoji.name}.png`), png);
    written += 1;
  }

  console.log(`已生成 ${written} 个表情 PNG -> ${outputDir}`);
  if (overrideUsed.length > 0) {
    console.log(`本地 override: ${overrideUsed.join("、")}`);
  }
  if (spriteFallback.length > 0) {
    console.log(`雪碧图兜底: ${spriteFallback.join("、")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
