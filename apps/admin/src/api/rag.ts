import { request, type RequestResult } from "@/lib/request";
import type { RagQueryRequest, RagQueryResponse } from "@/types/rag";

/**
 * 基于已上传文档执行检索增强问答。
 *
 * @param payload - 含提问与检索数量的请求体
 * @returns 答案与来源片段
 */
export function queryRag(payload: RagQueryRequest): Promise<RequestResult<RagQueryResponse>> {
  return request<RagQueryResponse>({
    url: "/api/admin/rag/query",
    method: "POST",
    data: payload,
  });
}
