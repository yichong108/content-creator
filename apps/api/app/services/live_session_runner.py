import asyncio
import logging

from sqlalchemy import select

from app.db import async_session
from app.models.live_session import LiveSessionRow
from app.schemas.chat_item import ChatItem
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.live_chat_items_generator import generate_live_chat_item
from app.services.live_session_events import live_session_event_hub

logger = logging.getLogger(__name__)

# 推送完成后等待多久再续写下一条（秒）
LIVE_RUNNER_INTERVAL_AFTER_PUSH_SEC = 3.0

# 无 running 会话时的空转间隔（秒）
LIVE_RUNNER_IDLE_INTERVAL_SEC = 1.0


class LiveSessionRunner:
    """直播会话后台运行器，串行续写单条消息、入库并通过 SSE 推送。"""

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()

    @property
    def is_active(self) -> bool:
        """后台循环任务是否仍在运行。"""
        return self._task is not None and not self._task.done()

    async def start(self) -> None:
        """启动后台循环；若已在运行则忽略。"""
        if self.is_active:
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop(), name="live-session-runner")

    async def stop(self) -> None:
        """停止后台循环并等待任务结束。"""
        self._stop_event.set()
        if self._task is not None:
            await self._task
            self._task = None

    async def _run_loop(self) -> None:
        """串行续写：生成一条 → 入库 → SSE 推送 → 等待 3 秒 → 下一条。"""
        while not self._stop_event.is_set():
            try:
                appended = await self._append_once()
            except Exception:
                logger.exception("直播会话续写失败")
                appended = False

            interval = LIVE_RUNNER_INTERVAL_AFTER_PUSH_SEC if appended else LIVE_RUNNER_IDLE_INTERVAL_SEC
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval)
                break
            except TimeoutError:
                continue

    async def _append_once(self) -> bool:
        """为当前 running 的直播会话生成、入库并推送单条新消息。

        Returns:
            是否成功追加并推送了一条消息。
        """
        async with async_session() as db:
            result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.running.is_(True)).limit(1))
            row = result.scalar_one_or_none()
            if row is None:
                return False

            live_session_id = row.id
            existing_items = [ChatItem.model_validate(item) for item in row.chat_items]
            try:
                new_item = await generate_live_chat_item(row.title, existing_items)
            except (
                AiConfigurationError,
                AiAuthenticationError,
                AiConnectionError,
                AiUnavailableError,
                AiResponseError,
                ValueError,
            ) as exc:
                logger.warning("直播会话 %s 续写跳过: %s", live_session_id, exc)
                return False

            row.chat_items = [*row.chat_items, new_item.model_dump()]
            await db.commit()

            total = len(row.chat_items)
            index = total - 1
            logger.info("直播会话 %s 追加 1 条消息，当前共 %d 条", live_session_id, total)

        await live_session_event_hub.publish(
            "message",
            {
                "live_session_id": live_session_id,
                "item": new_item.model_dump(),
                "total": total,
                "index": index,
            },
        )
        return True


live_session_runner = LiveSessionRunner()
