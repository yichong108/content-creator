from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 固定指向 apps/api/.env，避免从 monorepo 根目录启动时读不到配置
_API_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _API_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str = ""
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"
    database_url: str = "mysql+aiomysql://wechat:wechat@127.0.0.1:3307/wechat_bot?charset=utf8mb4"
    uploads_dir: str = "uploads"
    # JWT 签名密钥与过期时间（分钟），用于管理后台登录认证
    jwt_secret: str = "change-me-in-prod"
    jwt_expire_minutes: int = 60 * 24
    # 首次启动时种子的默认管理员账号
    admin_initial_username: str = "admin"
    admin_initial_password: str = "admin123456"
    # RAG 嵌入模型（fastembed 离线本地模型，默认 BGE 中文小模型）
    rag_embedding_model: str = "BAAI/bge-small-zh-v1.5"
    # RAG 向量索引落盘子目录（相对 apps/api，Chroma 数据与 LlamaIndex docstore）
    rag_storage_dir: str = "data/rag"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def uploads_path(self) -> Path:
        """上传文件根目录（相对 apps/api）。"""
        return _API_ROOT / self.uploads_dir

    @property
    def rag_storage_path(self) -> Path:
        """RAG 向量索引持久化目录（相对 apps/api）。"""
        return _API_ROOT / self.rag_storage_dir


settings = Settings()
