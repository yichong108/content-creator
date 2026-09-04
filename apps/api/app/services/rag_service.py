"""RAG 服务：文档文本解析 + LlamaIndex(Chroma) 向量索引与检索。

采用嵌入式 Chroma 向量数据库将向量落盘到 ``data/rag/``，重启后加载，
上传/删除文档时增量更新索引（不重复索引已有文档）。
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import cast

import chromadb
import docx2txt
from llama_index.core import Document, StorageContext, VectorStoreIndex, load_index_from_storage
from llama_index.core.schema import NodeWithScore
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
from pypdf import PdfReader

from app.config import settings

RAG_COLLECTION_NAME = "documents"


def extract_text(path: Path, extension: str) -> str:
    """从已保存的文档文件提取纯文本。

    Args:
        path: 文档文件绝对路径。
        extension: 小写扩展名（.txt / .pdf / .docx）。

    Returns:
        提取出的纯文本；无法解析时返回空字符串。
    """
    if extension == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    if extension == ".pdf":
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if extension == ".docx":
        return docx2txt.process(str(path)) or ""
    return ""


class RagService:
    """文档索引与检索服务（单例）。"""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._index: VectorStoreIndex | None = None
        self._storage_context: StorageContext | None = None
        self._embed_model: FastEmbedEmbedding | None = None

    def _ensure_index(self) -> VectorStoreIndex | None:
        """懒加载向量索引；尚无任何文档时返回 ``None``。

        Returns:
            已加载的 ``VectorStoreIndex``；索引尚未建立时返回 ``None``。
        """
        if self._index is not None:
            return self._index

        with self._lock:
            if self._index is not None:
                return self._index

            self._embed_model = FastEmbedEmbedding(model_name=settings.rag_embedding_model)
            client = chromadb.PersistentClient(path=str(settings.rag_storage_path))
            collection = client.get_or_create_collection(RAG_COLLECTION_NAME)
            vector_store = ChromaVectorStore(chroma_collection=collection)

            self._storage_context = StorageContext.from_defaults(
                vector_store=vector_store,
                persist_dir=str(settings.rag_storage_path),
            )

            if (settings.rag_storage_path / "docstore.json").is_file():
                self._index = cast(
                    VectorStoreIndex,
                    load_index_from_storage(
                        self._storage_context,
                        embed_model=self._embed_model,
                    ),
                )
            else:
                self._index = None

            return self._index

    def ingest(self, document_id: int, filename: str, text: str) -> None:
        """将单个文档文本写入向量索引并持久化。

        Args:
            document_id: 文档 ID（同时用作 LlamaIndex ref_doc_id）。
            filename: 原始文件名，用于来源展示。
            text: 文档提取出的纯文本。
        """
        document = Document(
            doc_id=str(document_id),
            text=text,
            metadata={"document_id": document_id, "filename": filename},
        )

        with self._lock:
            index = self._ensure_index()
            assert self._storage_context is not None
            assert self._embed_model is not None

            if index is None:
                index = VectorStoreIndex.from_documents(
                    [document],
                    storage_context=self._storage_context,
                    embed_model=self._embed_model,
                )
                self._index = index
            else:
                index.insert(document)

            self._storage_context.persist(persist_dir=str(settings.rag_storage_path))

    def remove(self, document_id: int) -> None:
        """从向量索引中删除指定文档并持久化。

        Args:
            document_id: 文档 ID。
        """
        with self._lock:
            index = self._ensure_index()
            if index is None:
                return
            assert self._storage_context is not None
            index.delete_ref_doc(str(document_id), delete_from_docstore=True)
            self._storage_context.persist(persist_dir=str(settings.rag_storage_path))

    def retrieve(self, query: str, top_k: int) -> list[NodeWithScore]:
        """按语义相似度检索相关文档片段。

        Args:
            query: 用户提问。
            top_k: 返回片段数量。

        Returns:
            相关节点列表；尚无文档时返回空列表。
        """
        index = self._ensure_index()
        if index is None:
            return []
        retriever = index.as_retriever(similarity_top_k=top_k)
        return list(retriever.retrieve(query))


_rag_service: RagService | None = None


def get_rag_service() -> RagService:
    """获取 RAG 服务单例。

    Returns:
        全局唯一的 ``RagService`` 实例。
    """
    global _rag_service
    if _rag_service is None:
        _rag_service = RagService()
    return _rag_service
