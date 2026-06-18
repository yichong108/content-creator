import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# SSE 心跳间隔（秒）
LIVE_SSE_HEARTBEAT_SEC = 30.0


class LiveSessionEventHub:
    """直播会话 SSE 事件广播中心，将新消息与状态变更推送给所有订阅者。"""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        """注册 SSE 订阅队列。

        Returns:
            用于接收事件的异步队列。
        """
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        """移除 SSE 订阅队列。

        Args:
            queue: 先前由 ``subscribe`` 返回的队列。
        """
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, event: str, data: dict[str, Any]) -> None:
        """向所有订阅者广播 SSE 事件。

        Args:
            event: SSE event 名称。
            data: 可 JSON 序列化的事件载荷。
        """
        message = {"event": event, "data": data}
        async with self._lock:
            subscribers = list(self._subscribers)

        for queue in subscribers:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("直播 SSE 订阅队列已满，丢弃事件 %s", event)


live_session_event_hub = LiveSessionEventHub()
