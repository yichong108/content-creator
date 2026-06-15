"""Cursor SDK Bridge 生命周期：必须在主线程启动，不可在 ``asyncio.to_thread`` 中懒加载。"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import threading
from pathlib import Path
from urllib.parse import urlparse

import httpx
from cursor_sdk import Bridge, BridgeEndpoint, Client, close_default_client

from app.schemas.ai_config import AiConfig
from app.services.ai_config_store import load_ai_config
from app.services.ai_errors import AiConfigurationError

logger = logging.getLogger(__name__)

_API_ROOT = Path(__file__).resolve().parent.parent.parent
_PROJECT_ROOT = _API_ROOT.parent.parent
_WORKER_SCRIPT = _API_ROOT / "scripts" / "cursor_bridge_worker.py"

_bridge: Bridge | None = None
_client: Client | None = None
_worker_process: subprocess.Popen[str] | None = None
_lock = threading.Lock()


def _resolve_workspace(cwd: str) -> str:
    """解析 Local 模式下 Bridge 的工作目录。

    Args:
        cwd: 配置中的工作目录，留空则回退到 monorepo 根目录。

    Returns:
        绝对路径字符串。
    """
    value = cwd.strip()
    if value:
        return str(Path(value).expanduser().resolve())
    return str(_PROJECT_ROOT.resolve())


def _should_init_bridge(config: AiConfig) -> bool:
    """判断是否需要启动本地 Cursor Bridge。

    Args:
        config: 当前 AI 配置。

    Returns:
        ``provider`` 为 ``cursor_sdk`` 且已配置 API Key 时为 ``True``。
    """
    return config.provider == "cursor_sdk" and bool(config.cursor_sdk.api_key.strip())


def _is_local_bridge_url(url: str) -> bool:
    """判断 Bridge 地址是否为本地回环。

    Args:
        url: Bridge HTTP 基址。

    Returns:
        host 为 localhost/127.0.0.1/::1 时返回 ``True``。
    """
    host = (urlparse(url).hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "::1"}


def _bridge_http_client(base_url: str) -> httpx.Client | None:
    """为本地 Bridge 创建不走系统代理的 httpx 客户端。

    Windows 若开启系统/Clash 代理，``httpx`` 默认 ``trust_env=True`` 会把
    ``127.0.0.1`` 请求转发到代理，导致 Bridge RPC 返回 HTTP 502。

    Args:
        base_url: Bridge HTTP 基址。

    Returns:
        本地地址时返回 ``trust_env=False`` 的客户端；否则 ``None`` 使用默认行为。
    """
    if not _is_local_bridge_url(base_url):
        return None
    return httpx.Client(trust_env=False)


def _build_bridge_client(
    *,
    endpoint: BridgeEndpoint | None = None,
    base_url: str | None = None,
    auth_token: str | None = None,
) -> Client:
    """构造连接 Bridge 的 Client，本地地址时绕过系统代理。

    Args:
        endpoint: worker 返回的 discovery 端点。
        base_url: 外部 Bridge URL。
        auth_token: 外部 Bridge 认证 token。

    Returns:
        已配置 httpx 的 ``Client`` 实例。
    """
    if endpoint is not None:
        http_client = _bridge_http_client(endpoint.url)
        return Client(
            endpoint,
            allow_api_key_env_fallback=True,
            http_client=http_client,
        )

    assert base_url and auth_token
    http_client = _bridge_http_client(base_url)
    return Client(
        base_url=base_url,
        auth_token=auth_token,
        allow_api_key_env_fallback=True,
        http_client=http_client,
    )


def _strip_debugpy_env(env: dict[str, str]) -> dict[str, str]:
    """移除 debugpy 相关环境变量，避免子进程继承调试器状态。

    Args:
        env: 当前进程环境变量副本。

    Returns:
        清理后的环境变量，供 Bridge worker 子进程使用。
    """
    cleaned = dict(env)
    for key in list(cleaned.keys()):
        upper = key.upper()
        if "DEBUGPY" in upper or "PYDEVD" in upper or "VSCODE_DEBUG" in upper:
            del cleaned[key]
    return cleaned


def _worker_env(config: AiConfig) -> dict[str, str]:
    """构造 Bridge worker 子进程环境变量。

    Args:
        config: 当前 AI 配置。

    Returns:
        已清理 debugpy 并设置代理绕过与 API Key 的环境变量。
    """
    env = _strip_debugpy_env(os.environ)
    no_proxy_hosts = "127.0.0.1,localhost"
    existing = env.get("NO_PROXY", env.get("no_proxy", "")).strip()
    env["NO_PROXY"] = f"{existing},{no_proxy_hosts}" if existing else no_proxy_hosts
    env["no_proxy"] = env["NO_PROXY"]

    api_key = config.cursor_sdk.api_key.strip()
    if api_key:
        env["CURSOR_API_KEY"] = api_key
    return env


def _client_from_env() -> Client | None:
    """若已配置外部 Bridge 地址，则直接连接。

    Returns:
        连接成功的 ``Client``；未配置时返回 ``None``。
    """
    bridge_url = os.environ.get("CURSOR_SDK_BRIDGE_URL", "").strip()
    bridge_token = (
        os.environ.get("CURSOR_SDK_BRIDGE_TOKEN")
        or os.environ.get("CURSOR_SDK_BRIDGE_AUTH_TOKEN")
        or ""
    ).strip()
    if not bridge_url or not bridge_token:
        return None

    logger.info("使用外部 Cursor Bridge: %s", bridge_url)
    return _build_bridge_client(base_url=bridge_url, auth_token=bridge_token)


def _launch_bridge_via_worker(
    workspace: str,
    config: AiConfig,
) -> tuple[subprocess.Popen[str], Client]:
    """在独立子进程启动 Bridge，规避 debugpy 下 ``selectors.select`` 的 WinError 10038。

    Args:
        workspace: Agent 工作目录。

    Returns:
        worker 子进程与已连接的 ``Client`` 元组。

    Raises:
        AiConfigurationError: worker 启动失败或 discovery 无效时抛出。
    """
    if not _WORKER_SCRIPT.is_file():
        raise AiConfigurationError(f"缺少 Bridge worker 脚本: {_WORKER_SCRIPT}")

    proc = subprocess.Popen(
        [sys.executable, str(_WORKER_SCRIPT), workspace],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=_worker_env(config),
    )

    assert proc.stdout is not None
    try:
        line = proc.stdout.readline()
    except Exception as exc:
        proc.kill()
        raise AiConfigurationError("读取 Cursor Bridge discovery 失败") from exc

    if not line.strip():
        stderr_tail = proc.stderr.read(4000) if proc.stderr is not None else ""
        proc.kill()
        raise AiConfigurationError(
            f"Cursor Bridge 子进程未返回 discovery{f': {stderr_tail}' if stderr_tail else ''}",
        )

    try:
        discovery = json.loads(line)
        endpoint = BridgeEndpoint.from_discovery(discovery)
    except Exception as exc:
        proc.kill()
        raise AiConfigurationError("Cursor Bridge discovery JSON 无效") from exc

    client = _build_bridge_client(endpoint=endpoint)
    return proc, client


def ensure_cursor_bridge(config: AiConfig | None = None) -> None:
    """在主线程启动 Cursor Bridge（幂等）。

    VS Code debugpy 会破坏 ``Bridge.launch`` 内的 ``selectors.select``（WinError 10038），
    因此默认通过独立 worker 子进程启动 Bridge。

    Args:
        config: 可选配置；缺省时读取磁盘配置。

    Raises:
        AiConfigurationError: 在非主线程尝试首次初始化，或 Bridge 启动失败时抛出。
    """
    global _bridge, _client, _worker_process

    cfg = config or load_ai_config()
    if not _should_init_bridge(cfg):
        return

    with _lock:
        if _client is not None:
            return

        if threading.current_thread() is not threading.main_thread():
            raise AiConfigurationError(
                "Cursor Bridge 尚未初始化，请重启 API 服务后再试",
            )

        external = _client_from_env()
        if external is not None:
            _client = external
            return

        workspace = _resolve_workspace(cfg.cursor_sdk.cwd)
        logger.info("启动 Cursor Bridge worker，workspace=%s", workspace)
        _worker_process, _client = _launch_bridge_via_worker(workspace, cfg)


def get_cursor_client() -> Client:
    """返回已初始化的 Cursor Client，供 ``Agent.prompt(..., client=...)`` 使用。

    Returns:
        主线程中已启动的 ``Client`` 实例。

    Raises:
        AiConfigurationError: Bridge 未初始化时抛出。
    """
    if _client is None:
        raise AiConfigurationError(
            "Cursor Bridge 未就绪：请确认 provider 为 cursor_sdk 且 API 服务已重启",
        )
    return _client


def shutdown_cursor_bridge() -> None:
    """关闭 Bridge、worker 子进程与默认 Client。"""
    global _bridge, _client, _worker_process

    with _lock:
        bridge = _bridge
        client = _client
        worker = _worker_process
        _bridge = None
        _client = None
        _worker_process = None

    try:
        if client is not None:
            client.close()
    finally:
        if worker is not None:
            if worker.stdin is not None:
                try:
                    worker.stdin.close()
                except OSError:
                    pass
            if worker.poll() is None:
                worker.terminate()
                try:
                    worker.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    worker.kill()
                    worker.wait(timeout=5)
        if bridge is not None:
            bridge.close()
        close_default_client()

    logger.info("Cursor Bridge 已关闭")
