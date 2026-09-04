/** RAG 检索问答请求体。 */
export interface RagQueryRequest {
  query: string;
  top_k?: number;
}

/** RAG 答案来源片段。 */
export interface RagSource {
  document_id: number;
  filename: string;
  score: number | null;
  snippet: string;
}

/** RAG 检索问答响应体。 */
export interface RagQueryResponse {
  answer: string;
  sources: RagSource[];
}
