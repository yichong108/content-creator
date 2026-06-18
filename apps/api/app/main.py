from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.http import register_exception_handlers
from app.models import live_session as _live_session_model  # noqa: F401
from app.models import session as _session_model  # noqa: F401
from app.routers.ai_config import router as ai_config_router
from app.routers.chat import router as chat_router
from app.routers.chat_items import router as chat_items_router
from app.routers.health import router as health_router
from app.routers.live_sessions import router as live_sessions_router
from app.routers.sessions import router as sessions_router
from app.services.cursor_bridge import ensure_cursor_bridge, shutdown_cursor_bridge
from app.services.live_session_runner import live_session_runner


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """应用启动时建表并初始化 Cursor Bridge。"""
    await init_db()
    ensure_cursor_bridge()
    yield
    await live_session_runner.stop()
    shutdown_cursor_bridge()


app = FastAPI(title="WeChat Bot API", version="0.1.0", lifespan=lifespan)

# 注册异常处理
register_exception_handlers(app)

# 注册路由
app.include_router(health_router)
app.include_router(chat_items_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(live_sessions_router, prefix="/api")
app.include_router(ai_config_router, prefix="/api")

# 注册 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
