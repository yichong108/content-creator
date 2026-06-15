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

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
