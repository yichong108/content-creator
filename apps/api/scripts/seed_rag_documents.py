"""种子脚本：以完整链路向系统灌入示例客服 FAQ 文档。

与 admin 上传接口行为一致，同时写入三处：
1. 磁盘文件（uploads/documents/{id}__{原文件名}.txt）
2. documents 数据库表
3. RAG 向量索引（Chroma + LlamaIndex）

具备幂等性：按文件名去重，重跑脚本会先清理已有记录再重建，
不会产生重复数据。

用法：
    cd apps/api
    uv run python scripts/seed_rag_documents.py

前提：数据库已启动（MySQL 可连接），admin 初始化已完成
（脚本会自动查 admin_users 表取第一个管理员作为 created_by）。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 确保可以 import app.*
_API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_API_ROOT))

from sqlalchemy import select  # noqa: E402

from app.db import async_session  # noqa: E402
from app.models.admin_user import AdminUserRow  # noqa: E402
from app.models.document import DocumentRow  # noqa: E402
from app.services.document_storage import (  # noqa: E402
    delete_document_file,
    document_extension_for,
    store_document_file,
)
from app.services.rag_service import get_rag_service  # noqa: E402

# 示例文档列表：(filename, 文本内容)
# 扩展名必须在 ALLOWED_DOCUMENT_EXTENSIONS 内，当前脚本统一用 .txt
_SEED_DOCUMENTS: list[tuple[str, str]] = [
    (
        "产品介绍与价格.txt",
        """产品介绍与价格

欢迎使用我们的智能客服系统！我们致力于为内容创作者提供一站式 AI 辅助创作服务，
帮助您提高内容生产效率，降低创作成本。

【核心功能】
1. AI 角色对话：支持自定义 NPC 角色，模拟真实聊天场景，生成逼真的对话记录。
2. 会话截图生成：一键将对话渲染成高仿微信风格的图片，用于朋友圈、小红书等平台发布。
3. 知识库问答：基于上传的文档，提供 RAG 增强的智能客服问答。
4. 多角色互动：支持多个 NPC 角色在同一会话中互动，生成群聊内容。

【价格方案】
- 免费版：每天 50 次 AI 调用，单 NPC 角色，基础截图功能
- 基础版（99 元/月）：每天 500 次 AI 调用，最多 5 个 NPC 角色，全部截图模板
- 专业版（299 元/月）：每天 2000 次 AI 调用，不限 NPC 数量，优先处理队列
- 企业版：定制化方案，联系商务获取报价

【支付方式】
支持微信支付、支付宝、银行卡转账。企业版可开具增值税专用发票。
""",
    ),
    (
        "发货与物流政策.txt",
        """发货与物流政策

【服务性质说明】
本产品为 SaaS 在线服务，不涉及实体商品发货。您在购买后立即获得账户权限，
可以直接登录使用全部功能，无需等待物流配送。

【开通时间】
- 免费版：注册即开通
- 付费版：支付成功后 1 分钟内自动开通，最长不超过 10 分钟
- 企业版：合同签署后 1 个工作日内完成部署

【账户安全】
开通后请及时修改初始密码，建议开启二次验证。如遇登录问题，可联系客服协助重置。

【使用期限】
- 按月付费的套餐自开通日起 30 天有效
- 按年付费的套餐自开通日起 365 天有效
- 到期后可在账户中心续费，续费享有 9 折优惠
""",
    ),
    (
        "退换货政策.txt",
        """退换货政策

【退款规则】
由于本产品为在线数字化服务，一经开通即开始消耗服务器资源与 AI 调用额度，
因此退款规则如下：

1. 免费版：无需退款，不产生任何费用。
2. 付费版（按月）：开通后 7 天内，如未使用超过 10% 的 AI 调用额度，
   可申请全额退款。超过 7 天或使用额度超过 10% 不予退款。
3. 付费版（按年）：开通后 15 天内，如未使用超过 10% 的 AI 调用额度，
   可申请全额退款。超过 15 天或使用额度超过 10% 不予退款。
4. 企业版：按照合同约定执行退款条款。

【退款流程】
1. 在平台内提交退款申请（账户中心 → 账单管理 → 申请退款）
2. 客服会在 1-3 个工作日内审核您的申请
3. 审核通过后，退款将原路返回至您的支付账户
4. 微信/支付宝退款通常 1-3 个工作日到账，银行卡退款可能需要 3-7 个工作日

【特殊情况】
如遇系统故障、服务长时间不可用等平台责任问题，不受上述时间和额度限制，
可全额退款。请保留相关故障截图和记录作为申请凭证。

【账号封禁说明】
如因违反服务条款（如滥用 AI 接口、生成违法内容等）导致账号被封禁，
不予退款。
""",
    ),
    (
        "使用教程.txt",
        """使用教程

【快速上手】
1. 注册登录：使用邮箱或手机号注册账户，设置密码即可开始使用。
2. 创建 NPC 角色：在角色管理页面，点击"新建角色"，填写角色名称、
   人设描述、头像等信息。
3. 发起会话：在首页点击"发起会话"，选择一个或多个 NPC 角色，
   系统会自动开始生成对话内容。
4. 生成截图：对话生成完成后，点击"生成截图"，选择微信风格模板，
   即可下载或分享截图。

【NPC 角色设置建议】
- 人设描述越详细，AI 生成的对话越真实
- 建议包含：职业、性格、说话风格、常用口头禅、与其他角色的关系
- 可以为角色设定特定的语气（如温柔、幽默、专业）

【常见问题】
Q: AI 生成速度慢怎么办？
A: 免费版使用共享队列，高峰期可能排队。升级到付费版可获得优先处理。

Q: 可以自己上传聊天记录吗？
A: 目前不支持手动上传历史聊天记录。所有内容由 AI 根据人设自动生成。

Q: 生成的内容可以商用吗？
A: 可以。您通过本平台生成的所有对话内容和截图，版权归您所有，
   可自由用于商业用途。

【客服联系】
如遇到使用问题，可以：
- 在页面右下角点击客服图标在线咨询（工作时间 9:00-22:00）
- 发送邮件到 support@example.com（通常 24 小时内回复）
- 查看帮助中心的更多教程文章
""",
    ),
]


async def _find_created_by(db_session) -> int | None:
    """查 admin_users 表取第一个管理员的 id 作为 created_by。"""
    result = await db_session.execute(select(AdminUserRow).limit(1))
    admin = result.scalar_one_or_none()
    return admin.id if admin else None


async def _cleanup_existing(db_session, filename: str) -> None:
    """按文件名清理已存在的旧记录（DB + 磁盘文件 + 向量索引）。"""
    rag = get_rag_service()
    result = await db_session.execute(select(DocumentRow).where(DocumentRow.filename == filename))
    for row in result.scalars().all():
        rag.remove(row.id)
        delete_document_file(row.id, row.filename)
        await db_session.delete(row)
    await db_session.commit()


async def main_async() -> None:
    """完整链路批量灌入示例文档。"""
    rag = get_rag_service()

    print(f"准备写入 {len(_SEED_DOCUMENTS)} 份示例文档...")
    print(f"磁盘目录: {_API_ROOT / 'uploads' / 'documents'}")
    print(f"索引目录: {_API_ROOT / 'data' / 'rag'}")
    print("-" * 50)

    async with async_session() as db_session:
        created_by = await _find_created_by(db_session)
        print(f"created_by = {created_by}")
        print()

        for filename, text in _SEED_DOCUMENTS:
            print(f"[{filename}] ({len(text)} 字符)...")

            # 幂等清理
            print("  清理已有记录... ", end="", flush=True)
            await _cleanup_existing(db_session, filename)
            print("✓")

            extension = document_extension_for(filename)
            if extension is None:
                print("  ✗ 跳过：扩展名不在允许列表内")
                continue

            # 写 DB 行
            row = DocumentRow(
                filename=filename,
                extension=extension.lstrip("."),
                file_size=len(text.encode("utf-8")),
                created_by=created_by,
            )
            db_session.add(row)
            await db_session.commit()
            await db_session.refresh(row)
            doc_id = row.id
            print(f"  DB 行 id={doc_id} ✓")

            # 存磁盘文件
            store_document_file(doc_id, filename, text.encode("utf-8"))
            print("  磁盘文件 ✓")

            # 写 RAG 向量索引
            rag.ingest(doc_id, filename, text)
            print("  RAG 索引 ✓")
            print()

    print("-" * 50)
    print("全部完成！")


def main() -> None:
    """同步入口：用 asyncio.run 执行异步灌入流程。"""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
