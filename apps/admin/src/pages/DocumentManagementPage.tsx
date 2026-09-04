import { useCallback, useEffect } from "react";

import { Button, Table, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";

import { downloadDocument } from "@/api/documents";
import { formatDateTime } from "@/lib/format";
import { useDocumentStore } from "@/stores/document-store";
import type { DocumentSummary } from "@/types/document";

/**
 * 将字节数格式化为可读大小。
 *
 * @param bytes - 字节数
 * @returns 如 "1.2 MB" 的可读字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * RAG 文档管理页面，展示文档列表并支持上传、下载与删除。
 */
export function DocumentManagementPage() {
  const documents = useDocumentStore((state) => state.documents);
  const total = useDocumentStore((state) => state.total);
  const page = useDocumentStore((state) => state.page);
  const pageSize = useDocumentStore((state) => state.pageSize);
  const listLoading = useDocumentStore((state) => state.listLoading);
  const mutating = useDocumentStore((state) => state.mutating);
  const error = useDocumentStore((state) => state.error);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);
  const uploadDocument = useDocumentStore((state) => state.uploadDocument);
  const deleteDocument = useDocumentStore((state) => state.deleteDocument);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleUpload = useCallback(
    (file: File) => {
      void uploadDocument(file);
    },
    [uploadDocument],
  );

  const handleDownload = useCallback((doc: DocumentSummary) => {
    void downloadDocument(doc.id, doc.filename);
  }, []);

  const handleDelete = useCallback(
    async (doc: DocumentSummary) => {
      const confirmed = window.confirm(`确定删除文档「${doc.filename}」吗？此操作不可恢复。`);
      if (!confirmed) {
        return;
      }
      await deleteDocument(doc.id);
    },
    [deleteDocument],
  );

  const columns: ColumnsType<DocumentSummary> = [
    {
      title: "文件名",
      dataIndex: "filename",
      key: "filename",
      render: (filename: string) => <span className="cell-title">{filename}</span>,
    },
    {
      title: "类型",
      dataIndex: "extension",
      key: "extension",
      width: 120,
      render: (extension: string) => <span>{extension.toUpperCase()}</span>,
    },
    {
      title: "大小",
      dataIndex: "file_size",
      key: "file_size",
      width: 140,
      render: (size: number) => <span>{formatFileSize(size)}</span>,
    },
    {
      title: "上传时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (value: string) => <span className="col-date">{formatDateTime(value)}</span>,
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_, doc) => (
        <div className="table-actions">
          <Button size="small" disabled={mutating} onClick={() => handleDownload(doc)}>
            下载
          </Button>
          <Button size="small" danger disabled={mutating} onClick={() => void handleDelete(doc)}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="page">
      <header className="page-header page-header--bare">
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void loadDocuments()}>
            刷新
          </button>
          <Upload
            accept=".txt,.pdf,.docx"
            showUploadList={false}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
          >
            <Button type="primary" loading={mutating}>
              上传文档
            </Button>
          </Upload>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card--flush">
        <Table<DocumentSummary>
          rowKey="id"
          columns={columns}
          dataSource={documents}
          loading={listLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (totalCount) => `共 ${totalCount} 个文档`,
            onChange: (nextPage, nextPageSize) => void loadDocuments(nextPage, nextPageSize),
          }}
          locale={{
            emptyText: (
              <div className="empty-state empty-state--table">
                <p className="muted">暂无文档</p>
                <Upload
                  accept=".txt,.pdf,.docx"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    handleUpload(file);
                    return false;
                  }}
                >
                  <Button type="primary">上传第一个文档</Button>
                </Upload>
              </div>
            ),
          }}
        />
      </div>
    </section>
  );
}
