/**
 * 将 ISO 时间格式化为本地可读字符串。
 *
 * @param value - ISO 8601 时间字符串
 * @returns 本地化日期时间
 */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
