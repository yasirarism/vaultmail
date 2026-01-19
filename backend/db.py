from motor.motor_asyncio import AsyncIOMotorClient
from backend.config import get_settings


class Database:
    def __init__(self) -> None:
        settings = get_settings()
        self.client = AsyncIOMotorClient(settings.mongodb_uri)
        self.db = self.client[settings.mongodb_db]

    async def init_indexes(self) -> None:
        settings = get_settings()
        await self.db.emails.create_index("address")
        await self.db.emails.create_index("email_id", unique=True)
        await self.db.emails.create_index(
            "created_at",
            expireAfterSeconds=settings.retention_seconds,
            name="created_at_ttl",
        )
        await self.db.sessions.create_index(
            "expires_at",
            expireAfterSeconds=0,
        )
        await self.db.domain_expirations.create_index("domain", unique=True)
        await self.db.domain_expirations.create_index(
            "checked_at",
            expireAfterSeconds=60 * 60 * 24,
        )


database = Database()
