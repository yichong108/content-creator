/**
 * 渲染 chat-202606060245 期抖音封面 PNG
 *
 * 运行:
 *   pnpm --dir apps/web screenshot:cover:202606060245
 *
 * 输出: apps/web/public/douyin-chat-cover-202606060245.png (1080×2160, 1:2)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const HTML_PATH = path.join(__dirname, "chat-cover-202606060245.html");
const OUT_PATH = path.join(WEB_ROOT, "public", "douyin-chat-cover-202606060245.png");
const WIDTH = 1080;
const HEIGHT = 2160;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(`file:///${HTML_PATH.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: OUT_PATH, type: "png" });
  console.log(`Saved ${OUT_PATH} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
