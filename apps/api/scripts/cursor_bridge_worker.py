"""在独立进程中启动 Cursor Bridge，避免 debugpy 污染主进程的 fd/select。

Windows 上 cursor-sdk 默认用 ``selectors`` 读取 bridge stderr，在 PIPE 模式下会触发
WinError 10038；本脚本在启动前将其替换为 ``readline`` 实现。
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from collections.abc import Mapping
from typing import Any

from cursor_sdk import Bridge
from cursor_sdk._bridge import parse_discovery_line
from cursor_sdk.errors import CursorSDKError


def _read_discovery_readline(
    process: subprocess.Popen[str],
    timeout: float,
) -> Mapping[str, Any]:
    """用阻塞 ``readline`` 读取 bridge discovery，兼容 Windows PIPE。

    Args:
        process: bridge 子进程句柄。
        timeout: 最长等待秒数。

    Returns:
        discovery 字典。

    Raises:
        CursorSDKError: stderr 不可用、进程提前退出或超时时抛出。
    """
    if process.stderr is None:
        raise CursorSDKError("Bridge process stderr is unavailable")

    deadline = time.monotonic() + timeout
    stderr_lines: list[str] = []

    while time.monotonic() < deadline:
        line = process.stderr.readline()
        if line:
            stderr_lines.append(line)
            discovery = parse_discovery_line(line)
            if discovery is not None:
                return discovery

        exit_code = process.poll()
        if exit_code is not None:
            raise CursorSDKError(
                f"Bridge exited before discovery with status {exit_code}: " + "".join(stderr_lines),
            )

        if not line:
            time.sleep(0.05)

    raise CursorSDKError("Timed out waiting for bridge discovery")


def _patch_bridge_discovery_reader() -> None:
    """将 cursor-sdk 的 discovery 读取替换为 Windows 兼容实现。"""
    import cursor_sdk._bridge as bridge_mod

    bridge_mod._read_discovery = _read_discovery_readline  # type: ignore[attr-defined]


def main() -> int:
    """启动 Bridge 并将 discovery 写到 stdout。

    Returns:
        进程退出码，0 表示正常关闭。
    """
    if len(sys.argv) < 2:
        print("usage: cursor_bridge_worker.py <workspace>", file=sys.stderr)
        return 2

    _patch_bridge_discovery_reader()
    workspace = sys.argv[1]
    bridge = Bridge.launch(workspace=workspace)
    payload = {
        "schemaVersion": 1,
        "transport": "tcp",
        "protocol": "connect",
        "url": bridge.endpoint.url,
        "authToken": bridge.endpoint.auth_token,
    }
    print(json.dumps(payload), flush=True)

    try:
        if sys.stdin is not None:
            sys.stdin.read()
    finally:
        bridge.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
