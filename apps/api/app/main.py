from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.http import register_exception_handlers
from app.models import chat_item as _chat_item_model  # noqa: F401
from app.routers.chat import router as chat_router
from app.routers.chat_items import router as chat_items_router
from app.routers.health import router as health_router
from app.seed.chat_items import seed_chat_items


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """应用启动时建表并在空库时导入初始聊天数据。"""
    await init_db()
    await seed_chat_items()
    yield


app = FastAPI(title="WeChat Bot API", version="0.1.0", lifespan=lifespan)
register_exception_handlers(app)
app.include_router(health_router)
app.include_router(chat_items_router, prefix="/api")
app.include_router(chat_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
