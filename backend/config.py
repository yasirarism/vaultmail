from functools import lru_cache
from pydantic import BaseModel
import os


class Settings(BaseModel):
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://mongo:27017")
    mongodb_db: str = os.getenv("MONGODB_DB", "vaultmail")
    retention_seconds: int = int(os.getenv("RETENTION_SECONDS", "86400"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
