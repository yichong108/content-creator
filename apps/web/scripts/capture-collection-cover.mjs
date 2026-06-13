/**
 * 渲染 1:1 正方形抖音合集封面 PNG
 *
 * 运行:
 *   pnpm --dir apps/web screenshot:cover
 *
 * 输出: apps/web/public/douyin-collection-cover-square.png (1080×1080)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const HTML_PATH = path.join(__dirname, "collection-cover-square.html");
const OUT_PATH = path.join(WEB_ROOT, "public", "douyin-collection-cover-square.png");
const SIZE = 1080;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
  });
  await page.goto(`file:///${HTML_PATH.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: OUT_PATH, type: "png" });
  console.log(`Saved ${OUT_PATH} (${SIZE}x${SIZE})`);
} finally {
  await browser.close();
}
