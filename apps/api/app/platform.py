import os
import sys


def fix_windows_env() -> None:
    """补全 Windows 下可能缺失的用户名环境变量。

    Turbo / VS Code 任务环境可能缺少 USERNAME，导致 aiomysql 导入时
    getpass.getuser() 回退到 Unix 的 pwd 模块而崩溃。

    在创建数据库引擎（会间接 import aiomysql）之前调用即可。
    """
    if sys.platform != "win32":
        return

    if os.environ.get("USERNAME") or os.environ.get("USER"):
        return

    profile = os.environ.get("USERPROFILE", "")
    if profile:
        username = os.path.basename(profile)
        os.environ["USERNAME"] = username
        os.environ.setdefault("USER", username)
        return

    try:
        username = os.getlogin()
    except OSError:
        username = "unknown"

    os.environ["USERNAME"] = username
    os.environ.setdefault("USER", username)
