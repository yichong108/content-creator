"""API 服务守护脚本：崩溃自动重启 + 可选源码热重载。

uvicorn 自带的 ``--reload`` 只在源码变更时重载 worker，worker 进程一旦崩溃
（例如 RAG 的 onnxruntime/chroma 原生库崩溃、进程被系统 OOM 杀掉）不会自动拉起，
导致服务挂掉后无人接管。本脚本在最外层包一层守护循环，用子进程运行 uvicorn，
worker 退出后等待片刻自动重启；加 ``--reload`` 时同时监听源码与 .env 变更触发热重载。

用法:
    uv run python scripts/serve.py            # 崩溃自动重启，无热重载
    uv run python scripts/serve.py --reload   # 崩溃自动重启 + 源码热重载
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys
import time
from collections.abc import Generator
from pathlib import Path

logger = logging.getLogger("api.supervisor")

# 崩溃后重新拉起前的等待时间（秒），避免连续崩溃形成风暴
RESTART_DELAY_SEC = 1.0

# 子进程存活轮询间隔（毫秒）。watchfiles 在该时间内无文件变更也会返回，
# 借此在等待热重载的同时周期性检查 worker 是否已经崩溃。
POLL_INTERVAL_MS = 500


def _uvicorn_argv() -> list[str]:
    """构造 uvicorn 子进程启动参数（关闭其自带 reload，由本脚本统一管理热重载）。"""
    return [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--timeout-graceful-shutdown",
        "3",
    ]


def _spawn() -> subprocess.Popen[bytes]:
    """启动 uvicorn 子进程并记录其 PID。"""
    process = subprocess.Popen(_uvicorn_argv())
    logger.info("已启动 API 子进程 PID=%d", process.pid)
    return process


def _terminate(process: subprocess.Popen[bytes]) -> None:
    """优雅停止子进程；超时后强制 kill，避免残留进程继续占用 8000 端口。"""
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def _env_mtime() -> float | None:
    """读取 .env 文件的修改时间；文件不存在时返回 ``None``。"""
    path = Path(".env")
    return path.stat().st_mtime if path.is_file() else None


def _make_watcher() -> Generator[set[tuple[object, str]], None, None]:
    """创建监听 app 源码目录的文件监听器。

    watchfiles 默认会忽略 ``__pycache__`` 与 ``*.pyc``，避免重启后重新生成
    字节码触发无限热重载。
    """
    from watchfiles import watch

    return watch("app", yield_on_timeout=True, rust_timeout=POLL_INTERVAL_MS)


def run_forever(reload: bool) -> None:
    """守护主循环：拉起子进程并在崩溃或源码变更后自动重启。

    Args:
        reload: 是否同时启用源码热重载（监听 app 目录与 .env 变更）。
    """
    process = _spawn()
    watcher = _make_watcher() if reload else None
    last_env_mtime = _env_mtime() if reload else None

    try:
        while True:
            if watcher is not None:
                # 阻塞至多 POLL_INTERVAL_MS 等待变更；期间周期返回以探测崩溃
                changes = next(watcher)
                source_changed = bool(changes)
                env_changed = _env_mtime() != last_env_mtime
            else:
                # 无热重载：直接阻塞等待子进程退出
                process.wait()
                source_changed = False
                env_changed = False

            if process.poll() is not None:
                # 子进程已退出（崩溃/退出）：记录退出码后自动重启
                logger.error(
                    "API 子进程退出（code=%d），%.1f 秒后自动重启",
                    process.returncode,
                    RESTART_DELAY_SEC,
                )
                time.sleep(RESTART_DELAY_SEC)
            elif watcher is not None and (source_changed or env_changed):
                # 源码或 .env 变更：停止旧进程并立即重启
                last_env_mtime = _env_mtime()
                logger.info("检测到源码/.env 变更，热重载服务...")
                _terminate(process)
            else:
                continue

            process = _spawn()
    except KeyboardInterrupt:
        logger.info("收到中断信号，停止服务")
    finally:
        _terminate(process)


def main() -> None:
    """解析命令行参数并启动守护循环。"""
    parser = argparse.ArgumentParser(description="带自动重启的 API 服务守护进程")
    parser.add_argument("--reload", action="store_true", help="启用源码热重载")
    args = parser.parse_args()
    run_forever(reload=args.reload)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    main()
