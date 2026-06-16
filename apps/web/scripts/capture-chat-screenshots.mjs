/**
 * 滚动聊天消息区并逐屏截图，直到滚到底部
 *
 * 聊天页的消息列表在内部 scroll 容器（main > section）中，
 * 整页截图无法覆盖全部内容，因此按视口高度分段滚动并保存 PNG。
 *
 * 运行（需先 pnpm dev）:
 *   pnpm --dir apps/web screenshot:chat
 *
 * 环境变量:
 *   CHAT_URL   - 页面地址，默认 http://localhost:3001
 *   OUT_DIR    - 输出目录，默认 apps/web/screenshots/chat
 *   VIEWPORT_W    - 视口宽度（CSS 像素）
 *   VIEWPORT_H    - 视口高度（CSS 像素）
 *   DEVICE_SCALE  - 设备像素比，默认 2（输出 PNG 为视口 × 该倍数，更清晰）
 *   OVERLAP       - 相邻截图重叠比例 0~1，默认 0.1
 *
 * 输出文件名: chat-{yyyyMMddHHmm}-{序号}.png
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");

const URL = process.env.CHAT_URL ?? "http://localhost:3001";
const OUT_DIR = process.env.OUT_DIR
  ? path.resolve(process.env.OUT_DIR)
  : path.join(WEB_ROOT, "screenshots", "chat");
const VIEWPORT = {
  width: Number(process.env.VIEWPORT_W ?? 375),
  height: Number(process.env.VIEWPORT_H ?? 667),
};
/** 设备像素比：2 时 375×667 视口输出 750×1334 PNG */
const DEVICE_SCALE = Math.min(
  4,
  Math.max(1, Number(process.env.DEVICE_SCALE ?? 2)),
);
const OVERLAP = Math.min(1, Math.max(0, Number(process.env.OVERLAP ?? 0.1)));
const SCROLL_SETTLE_MS = 300;

/**
 * 格式化为 yyyyMMddHHmm 本地时间戳，用于截图文件名
 *
 * @param {Date} [date=new Date()] - 待格式化的日期
 * @returns {string} 例如 202506061430
 */
function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes())
  );
}

/**
 * 读取 scroll 容器的滚动状态
 *
 * @param {import('playwright').Locator} chatSection - 消息列表 scroll 容器
 * @returns {Promise<{ scrollTop: number; scrollHeight: number; clientHeight: number }>}
 */
async function readScrollState(chatSection) {
  return chatSection.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
}

/**
 * 判断是否已滚到底部（允许 2px 误差）
 *
 * @param {{ scrollTop: number; scrollHeight: number; clientHeight: number }} state
 * @returns {boolean}
 */
function isAtBottom(state) {
  return state.scrollTop + state.clientHeight >= state.scrollHeight - 2;
}

/**
 * 注入截图专用样式，改善 Chromium 桌面环境下的文字与图片锐度
 *
 * 页面 CSS 仅在 iOS/macOS 上启用 font-smoothing，截图脚本在 Windows/Linux
 * 运行时需单独开启，避免文字发虚。
 *
 * @param {import('playwright').Page} page - Playwright 页面实例
 * @returns {Promise<void>}
 */
async function applyScreenshotRenderingHints(page) {
  await page.addStyleTag({
    content: `
      body, body * {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
    `,
  });
}

/**
 * 主流程：打开页面、逐屏截图直至聊天区底部
 *
 * @returns {Promise<number>} 生成的截图数量
 */
async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  });

  try {
    await page.goto(URL, { waitUntil: "networkidle" });
    await applyScreenshotRenderingHints(page);

    const chatSection = page.locator("main > section");
    await chatSection.waitFor({ state: "visible" });

    const timestamp = formatTimestamp();
    let index = 0;
    let lastScrollTop = -1;

    while (true) {
      const file = path.join(
        OUT_DIR,
        `chat-${timestamp}-${String(index).padStart(3, "0")}.png`,
      );
      await page.screenshot({
        path: file,
        type: "png",
        scale: "device",
      });
      console.log(
        `已保存: ${file} (${VIEWPORT.width * DEVICE_SCALE}×${VIEWPORT.height * DEVICE_SCALE})`,
      );

      const state = await readScrollState(chatSection);

      if (isAtBottom(state) || state.scrollTop === lastScrollTop) {
        break;
      }

      lastScrollTop = state.scrollTop;
      const step = Math.floor(state.clientHeight * (1 - OVERLAP));
      await chatSection.evaluate((el, delta) => el.scrollBy(0, delta), step);
      await page.waitForTimeout(SCROLL_SETTLE_MS);
      index++;
    }

    console.log(`完成，共 ${index + 1} 张截图 → ${OUT_DIR}`);
    return index + 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
