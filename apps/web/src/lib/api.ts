import type { ChatItem } from "@/data/chat-items";
import { request, type Result } from "@/lib/request";

/**
 * 从后端 API 获取聊天列表数据。
 *
 * @returns 成功时携带 ChatItem 数组，失败时携带 RequestError
 */
export function fetchChatItems(): Promise<Result<ChatItem[]>> {
  return request<ChatItem[]>({ url: "/api/chat-items" });
}
