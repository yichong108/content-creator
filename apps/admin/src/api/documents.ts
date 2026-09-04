import axios from "axios";

import { getAuthToken } from "@/lib/auth-token";
import { request, type RequestResult } from "@/lib/request";
import {
  DOCUMENT_PAGE_SIZE,
  type DocumentPageResult,
  type DocumentSummary,
} from "@/types/document";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * 分页获取文档列表。
 *
 * @param page - 页码，从 1 开始
 * @param pageSize - 每页记录数，默认 10
 * @returns 分页文档列表
 */
export function fetchDocuments(
  page: number,
  pageSize: number = DOCUMENT_PAGE_SIZE,
): Promise<RequestResult<DocumentPageResult>> {
  return request<DocumentPageResult>({
    url: "/api/admin/documents",
    method: "GET",
    params: { page, page_size: pageSize },
  });
}

/**
 * 上传文档文件（.txt / .pdf / .docx）。
 *
 * @param file - 待上传文件
 * @returns 新建文档
 */
export function uploadDocument(file: File): Promise<RequestResult<DocumentSummary>> {
  const formData = new FormData();
  formData.append("file", file);

  return request<DocumentSummary>({
    url: "/api/admin/documents",
    method: "POST",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

/**
 * 删除指定文档。
 *
 * @param id - 文档 ID
 * @returns 空数据成功响应
 */
export function deleteDocument(id: number): Promise<RequestResult<null>> {
  return request<null>({
    url: `/api/admin/documents/${id}`,
    method: "DELETE",
  });
}

/**
 * 从响应头解析下载文件名。
 *
 * @param contentDisposition - 响应头 Content-Disposition 值
 * @param fallback - 解析失败时的回退文件名
 * @returns 解析出的文件名
 */
function resolveFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (encoded?.[1]) {
    return decodeURIComponent(encoded[1]);
  }

  const plain = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return plain?.[1] ?? fallback;
}

/**
 * 下载指定文档（携带鉴权 token，返回文件流）。
 *
 * @param id - 文档 ID
 * @param fallbackName - 无法从响应头解析时的回退文件名
 */
export async function downloadDocument(id: number, fallbackName: string): Promise<void> {
  const token = getAuthToken();
  const response = await axios.get(`${API_URL}/api/admin/documents/${id}/download`, {
    responseType: "blob",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const contentDisposition = response.headers["content-disposition"] as string | undefined;
  const filename = resolveFilename(contentDisposition, fallbackName);

  const objectUrl = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
