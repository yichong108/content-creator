/**
 * 将会话列表时间格式化为微信风格文案。
 *
 * 当天显示 ``HH:mm``，昨天显示「昨天」，同年显示 ``M月d日``，跨年显示 ``yyyy/M/d``。
 *
 * @param isoString - ISO 8601 时间字符串
 * @param now - 参考当前时间，便于测试
 * @returns 列表右侧展示的时间文案
 */
export function formatWechatSessionTime(isoString: string, now = new Date()): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayDiff = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);

  if (dayDiff === 0) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  if (dayDiff === 1) {
    return "昨天";
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 截断会话列表中的最近消息预览。
 *
 * @param text - 原始消息文本
 * @param maxLength - 最大字符数
 * @returns 截断后的预览文案
 */
export function truncateSessionPreview(text: string, maxLength = 40): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}
