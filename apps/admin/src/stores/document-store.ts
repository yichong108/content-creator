import { create } from "zustand";

import {
  deleteDocument as deleteDocumentApi,
  fetchDocuments,
  uploadDocument as uploadDocumentApi,
} from "@/api/documents";
import { getRequestErrorMessage } from "@/lib/request";
import { DOCUMENT_PAGE_SIZE, type DocumentSummary } from "@/types/document";

interface DocumentState {
  /** 文档列表（当前页） */
  documents: DocumentSummary[];
  /** 文档总数 */
  total: number;
  /** 当前页码，从 1 开始 */
  page: number;
  /** 每页记录数 */
  pageSize: number;
  /** 列表加载中 */
  listLoading: boolean;
  /** 上传/删除等操作执行中 */
  mutating: boolean;
  /** 最近一次错误信息 */
  error: string | null;
  /** 拉取文档列表 */
  loadDocuments: (page?: number, pageSize?: number) => Promise<void>;
  /** 上传文档 */
  uploadDocument: (file: File) => Promise<DocumentSummary | null>;
  /** 删除文档 */
  deleteDocument: (id: number) => Promise<boolean>;
  /** 清空错误信息 */
  clearError: () => void;
}

/**
 * 文档管理 Zustand store，负责列表与上传/删除状态。
 */
export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  total: 0,
  page: 1,
  pageSize: DOCUMENT_PAGE_SIZE,
  listLoading: false,
  mutating: false,
  error: null,

  loadDocuments: async (page: number = get().page, pageSize: number = get().pageSize) => {
    set({ listLoading: true, error: null, page, pageSize });
    const result = await fetchDocuments(page, pageSize);
    if (result.ok) {
      set({ documents: result.data.items, total: result.data.total, listLoading: false });
      return;
    }
    set({ listLoading: false, error: getRequestErrorMessage(result) });
  },

  uploadDocument: async (file: File) => {
    set({ mutating: true, error: null });
    const result = await uploadDocumentApi(file);
    if (!result.ok) {
      set({ mutating: false, error: getRequestErrorMessage(result) });
      return null;
    }
    await get().loadDocuments(1, get().pageSize);
    set({ mutating: false });
    return result.data;
  },

  deleteDocument: async (id: number) => {
    set({ mutating: true, error: null });
    const result = await deleteDocumentApi(id);
    if (result.ok) {
      const { page, pageSize, total } = get();
      // 删除后若当前页超出新的最大页码，则回退一页，避免停留空页
      const lastPage = Math.max(1, Math.ceil((total - 1) / pageSize));
      await get().loadDocuments(Math.max(1, Math.min(page, lastPage)), pageSize);
      set({ mutating: false });
      return true;
    }
    set({ mutating: false, error: getRequestErrorMessage(result) });
    return false;
  },

  clearError: () => {
    set({ error: null });
  },
}));
