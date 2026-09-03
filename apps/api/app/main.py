from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.http import register_exception_handlers
from app.models import live_session as _live_session_model  # noqa: F401
from app.models import npc as _npc_model  # noqa: F401
from app.models import session as _session_model  # noqa: F401 — 迁移前仍需 sessions 表
from app.routers.ai_config import router as ai_config_router
from app.routers.chat import router as chat_router
from app.routers.chat_items import router as chat_items_router
from app.routers.health import router as health_router
from app.routers.live_sessions import router as live_sessions_router
from app.routers.npcs import router as npcs_router
from app.services.live_session_runner import live_session_runner
from app.services.npc_avatar import ensure_npc_upload_dir


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """应用启动时建表并初始化上传目录。"""
    await init_db()
    ensure_npc_upload_dir()
    yield
    await live_session_runner.stop()


app = FastAPI(title="ContentCreator API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册异常处理
register_exception_handlers(app)

# 路由前缀统一声明区 — 所有模块 prefix 直接写在下方 include_router 中，
# 各 router 文件内不再设置 prefix，避免前缀分散在两处维护。
app.include_router(health_router)
app.include_router(chat_items_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(live_sessions_router, prefix="/api/admin/live-sessions")
app.include_router(npcs_router, prefix="/api/admin/npcs")
app.include_router(ai_config_router, prefix="/api/admin/ai-config")

ensure_npc_upload_dir()
app.mount("/uploads", StaticFiles(directory=settings.uploads_path), name="uploads")
