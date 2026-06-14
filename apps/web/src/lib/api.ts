import type { ChatItem } from "@/data/chat-items";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 从后端 API 获取聊天列表数据。
 *
 * @returns 按时间顺序排列的 ChatItem 数组
 * @throws 当 HTTP 响应非 2xx 时抛出错误
 */
export async function fetchChatItems(): Promise<ChatItem[]> {
  const response = await fetch(`${API_URL}/api/chat-items`, {
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error(`获取聊天数据失败: ${response.status}`);
  }

  return response.json() as Promise<ChatItem[]>;
}
