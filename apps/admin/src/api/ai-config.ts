import type { AiConfig } from "@/types/ai-config";
import { request, type RequestResult } from "@/lib/request";

/**
 * 获取当前 AI 配置。
 *
 * @returns OpenAI 与 Cursor SDK 两套配置及当前选中的提供商
 */
export function fetchAiConfig(): Promise<RequestResult<AiConfig>> {
  return request<AiConfig>({ url: "/api/admin/ai-config", method: "GET" });
}

/**
 * 保存 AI 配置。
 *
 * @param payload - 完整 AI 配置（切换 provider 时仍应提交两套字段）
 * @returns 保存后的 AI 配置
 */
export function saveAiConfig(payload: AiConfig): Promise<RequestResult<AiConfig>> {
  return request<AiConfig>({
    url: "/api/admin/ai-config",
    method: "PUT",
    data: payload,
  });
}
