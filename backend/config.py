from functools import lru_cache
from pydantic import BaseModel, Field
import os
import json


class Settings(BaseModel):
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://mongo:27017")
    mongodb_db: str = os.getenv("MONGODB_DB", "vaultmail")
    retention_seconds: int = int(os.getenv("RETENTION_SECONDS", "86400"))
    admin_password: str = os.getenv("ADMIN_PASSWORD", "")
    attachment_max_bytes: int = int(os.getenv("ATTACHMENT_MAX_BYTES", "2000000"))
    cron_secret: str = os.getenv("CRON_SECRET", "")
    default_domains: list[str] = Field(default_factory=list)


def _normalize_list(value: str) -> list[str]:
    trimmed = value.strip()
    if not trimmed:
        return []
    if trimmed.startswith("["):
        try:
            parsed = json.loads(trimmed)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            return []
    return [item.strip() for item in trimmed.split(",") if item.strip()]


def _get_default_domains() -> list[str]:
    env_domains = os.getenv("DEFAULT_DOMAINS") or os.getenv("NEXT_PUBLIC_DEFAULT_DOMAINS", "")
    domains = _normalize_list(env_domains)
    if domains:
        return list(dict.fromkeys(domains))
    return ["ysweb.biz.id"]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.default_domains = _get_default_domains()
    return settings
