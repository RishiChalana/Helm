from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    db_ssl_required: bool = False  # set True on Render/Supabase; False for local Postgres
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    groq_api_key: str
    google_api_key: str = ""
    expo_push_token_base_url: str = "https://exp.host/--/api/v2/push/send"
    environment: str = "development"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
