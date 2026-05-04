from __future__ import annotations

from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "development"
    # By default assume a local postgres for development; override via env DATABASE_URL
    database_url: Optional[str] = "postgresql+asyncpg://postgres:postgres@localhost:5432/backend_proxy"
    jwt_secret: Optional[str] = None
    jwt_expire_minutes: int = 60
    backend_api_url: Optional[str] = None
    # Timeout for upstream backend requests (seconds)
    backend_timeout: int = 120
    redis_url: Optional[str] = None
    # During local development allow common local origins and the browser-extension origin
    # NOTE: In production set this via env CORS_ORIGINS to a restrictive list.
    cors_origins: List[str] = [
        "http://localhost",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8001",
        # Add your extension origin shown in the browser console when blocked by CORS
        # Example (dev): chrome-extension://lhkbocjamghlalfllmajcgdjpaoefjli
    ]
    rate_limit: int = 10
    # Rate limit window in seconds for public prompts endpoints
    rate_limit_window_sec: int = 60
    prometheus_enabled: bool = False

    # Prompt Base upstream configuration (adapter M1)
    prompt_base_url: Optional[str] = None
    prompt_base_timeout: int = 30
    prompt_base_cache_ttl: int = 0
    prompt_base_service_token: Optional[str] = None
    prompt_base_max_retries: int = 2
    prompt_base_retry_backoff_ms: int = 300
    prompt_base_circuit_fail_threshold: int = 20
    prompt_base_circuit_reset_sec: int = 30
    prompt_base_concurrency: int = 64
    prompt_base_allowed_hosts: List[str] | None = None
    prompt_base_max_body_bytes: int = 1024 * 1024
    prompt_base_compat_enabled: bool = False

    # Entropy ingestion limits
    entropy_max_archive_bytes: int = 200 * 1024 * 1024
    entropy_max_line_bytes: int = 1 * 1024 * 1024
    entropy_cache_ttl_sec: int = 300

    class Config:
        env_file = ".env"

    @property
    def is_development(self) -> bool:
        return self.env in ("dev", "development")


