import type { ChatItem } from "@/data/chat-items";
import { request, type RequestResult } from "@/lib/request";

/**
 * 从后端 API 获取聊天列表数据。
 *
 * @returns 业务 data 为 ChatItem 数组
 */
export function fetchChatItems(): Promise<RequestResult<ChatItem[]>> {
  return request<ChatItem[]>({ url: "/api/chat-items" });
}
