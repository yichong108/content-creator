# 文档管理 + RAG 功能实现计划

## 一、概述

为管理后台新增「文档管理」与「RAG 测试」两个页面，后端新增文档管理接口与基于 LlamaIndex 的 RAG 接口：

1. **文档管理**：上传（word/txt/pdf）、下载、删除、列表展示，不支持编辑。
2. **RAG**：基于 LlamaIndex 建向量索引（本地 fastembed 嵌入 + SimpleVectorStore 落盘），提供检索问答接口。
3. **RAG 测试页**：用于验证 RAG 问答效果。

## 二、现状分析（已探明）

### 技术栈
- 前端 `apps/admin`：React 19 + antd 6 + zustand + axios + react-router 7。
- 后端 `apps/api`：FastAPI + SQLAlchemy(async, aiomysql) + Pydantic v2 + LangChain(`create_agent`) + OpenAI 兼容 API。
- 后端包管理使用 `uv`（存在 `uv.lock` / `.python-version`），前端使用 pnpm。
- 当前 AI 配置指向 **DeepSeek**（`https://api.deepseek.com/v1`，`deepseek-v4-flash`），DeepSeek **不提供 embedding API**。

### 关键现有模式
- **统一响应**：`ApiResponse` + `success_response` / `fail_response`；异常通过 `raise HTTPException(...)` 由 [exceptions.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/http/exceptions.py) 统一转换。文档增删改查应沿用此规范。
- **上传存储参考**：[npc_avatar.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/services/npc_avatar.py) 的 `save_*_file` / `resolve_*_path` / `delete_local_*_file` 模式。
- **分页**：`PageResult[T]`（见 [pagination.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/schemas/pagination.py)），列表接口参考 [npcs.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/routers/npcs.py) 的 `list_npcs`。
- **AI 调用**：[ai_provider.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/services/ai_provider.py) 提供同步的 `invoke_chat()`（内部用 `_build_llm` 对 DeepSeek 关闭 thinking），路由层用 `asyncio.to_thread` 包装；失败通过 [ai_http.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/services/ai_http.py) 的 `fail_from_ai_error` 映射。
- **前端表格页参考**：[NpcManagementPage.tsx](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/pages/NpcManagementPage.tsx)（antd `Table` + 分页 + 刷新/新建）。
- **前端 store 参考**：[npc-store.ts](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/stores/npc-store.ts)；API 封装参考 [npcs.ts](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/api/npcs.ts)。
- **路由注册**：集中写在 [main.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/main.py)（`include_router` 时声明 prefix）；前端路由写在 [router.tsx](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/router.tsx)，左菜单写在 [AdminLayout.tsx](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/layouts/AdminLayout.tsx)。

## 三、方案决策（已与用户确认）

- **嵌入模型**：本地 `fastembed`（BGE 中文模型，默认 `BAAI/bge-small-zh-v1.5`），离线运行、无需额外 API Key。
- **向量存储**：LlamaIndex `SimpleVectorStore` 落盘到 `apps/api/data/rag/`，重启后加载，上传/删除时增量更新（不重复索引）。
- **文档文件存储**：存到 `uploads/documents/`，与 NPC 头像存储模式一致（复用 `settings.uploads_path`）；下载一律走鉴权接口 `GET /api/admin/documents/{id}/download`。
- **最终答案合成**：复用现有 `invoke_chat()`（已处理好 DeepSeek thinking 禁用 + 错误映射），LlamaIndex 只负责解析/嵌入/向量检索。

## 四、后端改动

### 4.1 依赖（`apps/api/pyproject.toml`）

新增依赖（用 `uv add` 安装）：

```toml
"llama-index-core>=0.12.0,<1.0",
"llama-index-embeddings-fastembed>=0.4.0,<1.0",
"llama-index-vector-stores-chroma>=0.4.0,<1.0",
"pypdf>=5.0,<7.0",
"docx2txt>=0.8,<1.0",
```

- `llama-index-core`：`VectorStoreIndex` / `StorageContext` / `Document` / `load_index_from_storage`。
- `llama-index-embeddings-fastembed`：`FastEmbedEmbedding`（词嵌入，BGE 中文）。
- `llama-index-vector-stores-chroma`：`ChromaVectorStore`（嵌入式向量数据库，本地持久化）。
- `pypdf` / `docx2txt`：分别解析 PDF / .docx 文本（.txt 直接读）。

### 4.2 配置（`apps/api/app/config.py`）

在 `Settings` 中新增：

```python
# RAG 嵌入模型（fastembed，离线本地模型）
rag_embedding_model: str = "BAAI/bge-small-zh-v1.5"
# RAG 索引落盘子目录（相对 apps/api）
rag_storage_dir: str = "data/rag"
```

并新增属性（复用现有 `_API_ROOT`）：

```python
@property
def rag_storage_path(self) -> Path:
    """RAG 向量索引持久化目录（相对 apps/api）。"""
    return _API_ROOT / self.rag_storage_dir
```

> 文档文件不新增独立配置，直接复用现有 `settings.uploads_path`，存入 `uploads_path / "documents"`，与 NPC 头像的存储模式保持一致。

### 4.3 数据模型（`apps/api/app/models/document.py`，新建）

```python
class DocumentRow(Base):
    __tablename__ = "documents"

    id: Mapped[int]  # BigInteger 主键自增
    filename: Mapped[str]      # 原始文件名 String(255)
    extension: Mapped[str]     # 小写扩展名，如 .pdf / .txt / .docx
    file_size: Mapped[int]     # 字节数 BigInteger
    created_at / updated_at    # DateTime，与 NpcRow 一致
```

- 磁盘文件命名为 `{id}{extension}`，由 `document_storage.save_document_file()` 生成。
- 在 [models/__init__.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/models/__init__.py) 中导出 `DocumentRow`，并在 [main.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/main.py) 顶部 `from app.models import document as _document_model` 以触发建表（`create_all` 会自动建新表，无需额外迁移）。

### 4.4 Schema（`apps/api/app/schemas/document.py`，新建）

- `DocumentSummary`：`id`、`filename`、`extension`、`file_size`、`created_at`、`updated_at`。
- 列表复用 `PageResult[DocumentSummary]`。

### 4.5 Schema（`apps/api/app/schemas/rag.py`，新建）

```python
class RagQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=20)

class RagSource(BaseModel):
    document_id: int
    filename: str
    score: float | None
    snippet: str          # 截断后的来源片段（约 200 字）

class RagQueryResponse(BaseModel):
    answer: str
    sources: list[RagSource] = []
```

### 4.6 文档存储服务（`apps/api/app/services/document_storage.py`，新建）

仿照 [npc_avatar.py](d:/wishzhang/project/owner/wechat-bot/apps/api/app/services/npc_avatar.py)，文档文件统一存于 `uploads/documents/`：

- 允许扩展名与内容类型映射：`{".txt": "text/plain", ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}`。
- 不支持 **旧版 `.doc`**（docx2txt 不支持），上传时明确拒绝并提示仅支持 `.txt/.pdf/.docx`。
- 函数：`ensure_document_upload_dir() -> Path`（在 `lifespan` 中与 `ensure_npc_upload_dir` 一起调用）、`save_document_file(doc_id, extension, content) -> str`（返回 `/uploads/documents/{id}{ext}` 相对 URL）、`delete_document_file(doc_id, extension)`、`resolve_document_path(relative_url) -> Path | None`。
- `MAX_DOCUMENT_BYTES = 20 * 1024 * 1024`（20MB）。
- 下载不依赖 `/uploads` 静态资源，统一走鉴权接口（见 4.8），磁盘命名仍沿用 `{id}{ext}`。

### 4.7 文档解析 + RAG 服务（`apps/api/app/services/rag_service.py`，新建）

负责「文本解析 + LlamaIndex 索引/检索」，全部为**同步函数**（路由层用 `asyncio.to_thread` 调用）：

- `extract_text(path: Path, extension: str) -> str`：
  - `.txt`：`read_text(encoding="utf-8", errors="ignore")`。
  - `.pdf`：`pypdf.PdfReader` 逐页拼接。
  - `.docx`：`docx2txt.process(str(path))`。
- 单例状态（带 `threading.Lock`）：`_index`、`_storage_context`、`_embed_model`。
- `_embed_model()`：`FastEmbedEmbedding(model_name=settings.rag_embedding_model)`。
- `_ensure_index()`：懒加载 —— 若 `rag_storage_path` 存在 `docstore.json` 则 `load_index_from_storage`；否则创建空索引并 `persist`。
- `ingest(document_id: int, filename: str, text: str)`：构建 `Document(doc_id=str(document_id), text=text, metadata={"document_id": document_id, "filename": filename})`，`index.insert()` 后 `storage_context.persist()`。
- `remove(document_id: int)`：`index.delete_ref_doc(str(document_id), delete_from_docstore=True)` 后 `persist()`。
- `retrieve(query: str, top_k: int) -> list[NodeWithScore]`：`_ensure_index()` 后 `index.as_retriever(similarity_top_k=top_k).retrieve(query)`。
- 单例访问：`get_rag_service()`。

### 4.8 文档管理路由（`apps/api/app/routers/documents.py`，新建）

`router = APIRouter(tags=["admin-documents"], dependencies=[Depends(get_current_admin)])`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `""` | 分页列出文档（`page`/`page_size`），`order_by(created_at desc, id desc)`，返回 `PageResult[DocumentSummary]` |
| POST | `""` | `UploadFile` 上传：校验扩展名/大小 → 存文件 → 建 DB 行 → `asyncio.to_thread(extract_text + ingest)`；任一步失败则回滚（删文件/删行）并 `raise HTTPException` |
| GET | `"/{document_id}/download"` | `FileResponse` 下载，`Content-Disposition` 用 RFC5987 编码的原始文件名 |
| DELETE | `"/{document_id}"` | 删除：`asyncio.to_thread(remove)` → 删文件 → 删 DB 行 |

- 上传失败统一用 `raise HTTPException(status_code=400, detail=...)`（与记忆约束一致），由全局异常处理器转成 `code=40001`。
- 下载文件名 `quote` 后可兼容中文。

### 4.9 RAG 路由（`apps/api/app/routers/rag.py`，新建）

`router = APIRouter(tags=["admin-rag"], dependencies=[Depends(get_current_admin)])`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `"/query"` | 入参 `RagQueryRequest`，返回 `RagQueryResponse` |

流程：
1. 校验 `query` 非空。
2. `asyncio.to_thread(rag_service.retrieve, query, top_k)`；若未建索引或结果为 0，返回 `answer="暂无可检索的文档，请先上传文档。"` + 空 `sources`。
3. 将检索到的 `node.get_content()` 拼成上下文，构造 system 提示词「基于给定文档内容回答，若文档无答案则说明未知」，调用 `asyncio.to_thread(invoke_chat, [{"role":"system","content":提示词},{"role":"user","content":query}])`。
4. AI 异常用 `fail_from_ai_error` 映射；返回 `answer` + `sources`（含截断 snippet）。

### 4.10 注册路由（`apps/api/app/main.py`）

```python
from app.models import document as _document_model  # noqa: F401
from app.routers.documents import router as documents_router
from app.routers.rag import router as rag_router

app.include_router(documents_router, prefix="/api/admin/documents")
app.include_router(rag_router, prefix="/api/admin/rag")
```

## 五、前端改动

### 5.1 类型（新建）

- `apps/admin/src/types/document.ts`：`DocumentSummary`（`id`/`filename`/`extension`/`file_size`/`created_at`/`updated_at`）、`DocumentPageResult`、`DOCUMENT_PAGE_SIZE = 10`。
- `apps/admin/src/types/rag.ts`：`RagSource`、`RagQueryResponse`。

### 5.2 API（新建 `apps/admin/src/api/documents.ts`）

- `fetchDocuments(page, pageSize)`：GET `/api/admin/documents`。
- `uploadDocument(file: File)`：`FormData` POST `/api/admin/documents`（`Content-Type: multipart/form-data`）。
- `deleteDocument(id)`：DELETE `/api/admin/documents/${id}`。
- `downloadDocument(id, filename)`：直接用 `axios` + `getAuthToken()` 发 GET `/api/admin/documents/${id}/download`（`responseType: "blob"`），从 `Content-Disposition` 或入参 filename 生成文件名，`URL.createObjectURL` 触发下载。**不走** `request()`（它是 JSON 解包封装）。

### 5.3 API（新建 `apps/admin/src/api/rag.ts`）

- `queryRag(payload: { query: string; top_k?: number })`：POST `/api/admin/rag/query`。

### 5.4 Store（新建 `apps/admin/src/stores/document-store.ts`）

仿 [npc-store.ts](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/stores/npc-store.ts)，维护 `documents`/`total`/`page`/`pageSize`/`listLoading`/`uploading`/`error`，提供 `loadDocuments`/`uploadDocument`/`deleteDocument`（删除后处理空页回退）/`clearError`。

### 5.5 页面（新建 `apps/admin/src/pages/DocumentManagementPage.tsx`）

- antd `Table<DocumentSummary>`，列：文件名、类型（extension 大写）、大小（`format.ts` 增加或内联字节格式化）、上传时间（`formatDateTime`）、操作（下载 / 删除）。
- 工具栏：`刷新` + antd `Upload`（`showUploadList={false}`，`beforeUpload` 返回 `false` 拦下文件后调用 `store.uploadDocument`）作「上传文档」入口；上传中禁用。
- 删除用 `window.confirm` 二次确认。
- 分页 `showTotal: (t) => \`共 ${t} 个文档\``。

### 5.6 页面（新建 `apps/admin/src/pages/RagTestPage.tsx`）

- 大输入框（`提问`）+ `提交` 按钮；提交后 `queryRag`。
- 展示 `answer`（可直接渲染文本，转义后换行保留）与 `sources` 列表（文件名 + snippet）。
- `loading` / `error` 状态（复用 `getRequestErrorMessage`）。

### 5.7 路由与菜单

- [router.tsx](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/router.tsx)：新增
  - `<Route path="documents" element={<DocumentManagementPage />} />`
  - `<Route path="rag-test" element={<RagTestPage />} />`
- [AdminLayout.tsx](d:/wishzhang/project/owner/wechat-bot/apps/admin/src/layouts/AdminLayout.tsx)：在 `nav` 中新增「文档管理」（`/documents`）与「RAG 测试」（`/rag-test`）两个 `NavLink`。

## 六、假设与说明

- 「word 文档」按 `.docx` 支持；旧版 `.doc` 不支持（需转 .docx），上传时提示。
- 文档量按「小规模」处理，使用嵌入式 Chroma 向量数据库落盘 + 增量增删即可满足，不引入外部向量数据库服务。
- 向量检索/索引落盘于 `data/rag/`（Chroma 数据 + LlamaIndex docstore/index_store）。
- fastembed 首次运行会下载 BGE 模型到本地缓存（需可访问模型源，若网络受限需配置镜像/HF_ENDPOINT）。
- 不新增「重建索引」接口（持久化已足够；如需可后续补充）。
- 文档文件独立于 `/uploads`，下载必须鉴权。

## 七、验证步骤

1. 安装后端依赖：`cd apps/api && uv sync`（或 `uv add ...`）。
2. 启动后端：确认 `main.py` 无导入错误、`documents` 表自动创建、`uploads/documents` 与 `data/rag` 目录按需创建。
3. 前端 `pnpm typecheck`、`pnpm lint` 通过。
4. 手动验证：
   - 上传 `.txt`/`.pdf`/`.docx` 各一份 → 列表可见；上传非法扩展名被拒。
   - 下载 → 文件名/内容正确；删除 → 记录与磁盘文件、索引条目同步移除。
   - RAG 测试页对文档内容提问 → 返回基于文档的答案与来源；无文档时给出提示。
   - 重启后端 → 不重复上传仍能索引、RAG 依然可用（验证落盘加载）。
5. 后端 `ruff` / `mypy`（如项目约定）通过。