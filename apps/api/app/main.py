from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.db import init_db
from app.graph.chat import chat_graph, to_langchain_messages
from app.http import register_exception_handlers
from app.models import chat_item as _chat_item_model  # noqa: F401
from app.routers.chat_items import router as chat_items_router
from app.schemas.response import ApiResponse, ok
from app.seed.chat_items import seed_chat_items


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """应用启动时建表并在空库时导入初始聊天数据。"""
    await init_db()
    await seed_chat_items()
    yield


app = FastAPI(title="WeChat Bot API", version="0.1.0", lifespan=lifespan)
register_exception_handlers(app)
app.include_router(chat_items_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    message: ChatMessage


""" 健康检查接口 """


@app.get("/health", response_model=ApiResponse[dict[str, str]])
async def health() -> ApiResponse[dict[str, str]]:
    return ok({"status": "ok"})


""" 聊天接口 """


@app.post("/api/chat", response_model=ApiResponse[ChatResponse])
async def chat(request: ChatRequest) -> ApiResponse[ChatResponse]:
    payload = [message.model_dump() for message in request.messages]
    state = {"messages": to_langchain_messages(payload)}
    result = chat_graph.invoke(state)
    last = result["messages"][-1]
    return ok(
        ChatResponse(
            message=ChatMessage(role="assistant", content=str(last.content)),
        ),
    )
