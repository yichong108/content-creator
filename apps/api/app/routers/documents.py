import asyncio
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.admin_user import AdminUserRow
from app.models.document import DocumentRow
from app.schemas.document import DocumentSummary
from app.schemas.pagination import PageResult
from app.schemas.response import ApiResponse, success_response
from app.services.auth_security import get_current_admin
from app.services.document_storage import (
    ALLOWED_DOCUMENT_EXTENSIONS,
    MAX_DOCUMENT_BYTES,
    build_document_relative_url,
    delete_document_file,
    document_extension_for,
    resolve_document_path,
    store_document_file,
)
from app.services.rag_service import extract_text, get_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-documents"], dependencies=[Depends(get_current_admin)])

# 列表分页每页默认记录数
DEFAULT_PAGE_SIZE = 10


def _to_summary(row: DocumentRow) -> DocumentSummary:
    """将 ORM 行转换为文档摘要。

    Args:
        row: 数据库文档行。

    Returns:
        文档摘要对象。
    """
    return DocumentSummary(
        id=row.id,
        filename=row.filename,
        extension=row.extension,
        file_size=row.file_size,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _get_document_row(document_id: int, current_admin_id: int, db: AsyncSession) -> DocumentRow:
    """按 ID 查询当前用户的文档，不存在或无权限时抛出 404。

    Args:
        document_id: 文档 ID。
        current_admin_id: 当前登录管理员 ID。
        db: 异步数据库会话。

    Returns:
        文档 ORM 行。

    Raises:
        HTTPException: 文档不存在或不属于当前用户时返回 404。
    """
    result = await db.execute(
        select(DocumentRow).where(DocumentRow.id == document_id, DocumentRow.created_by == current_admin_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return row


@router.get("")
async def list_documents(
    current_admin: AdminUserRow = Depends(get_current_admin),
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100, description="每页记录数"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PageResult[DocumentSummary]]:
    """分页返回当前用户的文档列表，按上传时间降序排列。

    Args:
        current_admin: 当前登录管理员。
        page: 页码，从 1 开始。
        page_size: 每页记录数，默认 10，最大 100。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的分页文档列表。
    """
    total_stmt = select(func.count()).select_from(DocumentRow).where(DocumentRow.created_by == current_admin.id)
    total = (await db.execute(total_stmt)).scalar_one()

    stmt = (
        select(DocumentRow)
        .where(DocumentRow.created_by == current_admin.id)
        .order_by(DocumentRow.created_at.desc(), DocumentRow.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = [_to_summary(row) for row in rows]
    return success_response(PageResult[DocumentSummary](items=items, total=total, page=page, page_size=page_size))


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[DocumentSummary]:
    """上传文档并写入 RAG 向量索引。

    支持 .txt / .pdf / .docx；旧版 .doc 不支持。

    Args:
        file: 待上传的文档文件。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的新建文档摘要。

    Raises:
        HTTPException: 文件类型/大小/内容非法或索引失败时返回 400/500。
    """
    extension = document_extension_for(file.filename or "")
    if extension is None:
        raise HTTPException(status_code=400, detail="仅支持 txt、pdf、docx 格式的文档")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文档文件不能为空")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=400, detail="文档文件不能超过 20MB")

    filename = (file.filename or "document").strip()
    row = DocumentRow(
        filename=filename,
        extension=extension,
        file_size=len(content),
        created_by=current_admin.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    # 解析文本并写入索引，失败时回滚数据库与磁盘文件
    try:
        relative_url = await asyncio.to_thread(store_document_file, row.id, filename, content)
        path = resolve_document_path(relative_url)
        if path is None:
            raise ValueError("文档存储路径异常")

        text = await asyncio.to_thread(extract_text, path, extension)
        if not text.strip():
            raise ValueError("文档内容为空或无法解析")

        await asyncio.to_thread(get_rag_service().ingest, row.id, filename, text)
    except Exception as exc:  # noqa: BLE001 — 回滚后统一返回 400
        logger.exception("文档索引失败: %s", exc)
        delete_document_file(row.id, filename)
        await db.delete(row)
        await db.commit()
        raise HTTPException(status_code=400, detail=f"文档解析或索引失败: {exc}") from exc

    return success_response(_to_summary(row))


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """下载指定文档的原始文件。

    Args:
        document_id: 文档 ID。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        携带原始文件名的附件响应。

    Raises:
        HTTPException: 文档不存在或不属于当前用户，或文件缺失时返回 404。
    """
    row = await _get_document_row(document_id, current_admin.id, db)
    path = resolve_document_path(build_document_relative_url(row.id, row.filename))
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="文档文件缺失")

    media_type = ALLOWED_DOCUMENT_EXTENSIONS.get(row.extension, "application/octet-stream")
    return FileResponse(path=path, media_type=media_type, filename=row.filename)


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """删除指定文档，并同步移除向量索引与磁盘文件。

    Args:
        document_id: 文档 ID。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的空数据成功响应。

    Raises:
        HTTPException: 文档不存在或不属于当前用户时返回 404。
    """
    row = await _get_document_row(document_id, current_admin.id, db)

    await asyncio.to_thread(get_rag_service().remove, row.id)
    delete_document_file(row.id, row.filename)
    await db.delete(row)
    await db.commit()
    return success_response(None, message="deleted")
