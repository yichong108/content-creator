import type { TokenUsage } from "@/types/token-usage";
import { request, type RequestResult } from "@/lib/request";

/**
 * 获取累计 token 消耗与总量额度。
 *
 * @returns token 用量信息
 */
export function fetchTokenUsage(): Promise<RequestResult<TokenUsage>> {
  return request<TokenUsage>({ url: "/api/admin/token-usage", method: "GET" });
}
