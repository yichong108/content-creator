/**
 * 文档列表项（RAG 知识库文档）。
 */
export interface DocumentSummary {
  id: number;
  /** 原始文件名 */
  filename: string;
  /** 小写扩展名，如 .pdf / .txt / .docx */
  extension: string;
  /** 文件字节数 */
  file_size: number;
  /** 上传时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 后端分页返回的文档列表。 */
export interface DocumentPageResult {
  items: DocumentSummary[];
  total: number;
  page: number;
  page_size: number;
}

/** 文档列表默认每页记录数。 */
export const DOCUMENT_PAGE_SIZE = 10;
