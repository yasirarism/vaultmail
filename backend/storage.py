from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import uuid4
from backend.db import database
from backend.models import (
    AdminStats,
    Attachment,
    EmailIn,
    EmailOut,
    RetentionSettings,
    TelegramSettings,
)
from backend.utils import extract_email


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_email(doc: dict) -> EmailOut:
    return EmailOut(
        id=doc["email_id"],
        from_address=doc["from"],
        to_address=doc["to"],
        subject=doc.get("subject", ""),
        text=doc.get("text"),
        html=doc.get("html"),
        attachments=[Attachment(**a) for a in doc.get("attachments", [])],
        received_at=doc["created_at"],
        read=doc.get("read", False),
    )


async def store_email(payload: EmailIn) -> str:
    email_id = str(uuid4())
    clean_to = extract_email(payload.to_address) or payload.to_address
    doc = {
        "email_id": email_id,
        "from": payload.from_address,
        "to": payload.to_address,
        "address": clean_to.lower(),
        "subject": payload.subject,
        "text": payload.text,
        "html": payload.html,
        "attachments": [a.model_dump() for a in payload.attachments],
        "created_at": _now(),
        "read": False,
    }
    await database.db.emails.insert_one(doc)
    return email_id


async def fetch_inbox(address: str) -> List[EmailOut]:
    cursor = database.db.emails.find({"address": address.lower()}).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return [_serialize_email(doc) for doc in docs]


async def fetch_email(email_id: str) -> Optional[dict]:
    return await database.db.emails.find_one({"email_id": email_id})


async def mark_read(email_id: str) -> None:
    await database.db.emails.update_one(
        {"email_id": email_id},
        {"$set": {"read": True}},
    )


async def get_retention_settings(default_seconds: int) -> RetentionSettings:
    doc = await database.db.settings.find_one({"key": "retention"})
    if doc and "seconds" in doc:
        return RetentionSettings(seconds=doc["seconds"], updated_at=doc["updated_at"])
    return RetentionSettings(seconds=default_seconds, updated_at=_now())


async def set_retention_settings(seconds: int) -> RetentionSettings:
    record = RetentionSettings(seconds=seconds, updated_at=_now())
    await database.db.settings.update_one(
        {"key": "retention"},
        {"$set": {"seconds": record.seconds, "updated_at": record.updated_at}},
        upsert=True,
    )
    try:
        await database.db.emails.drop_index("created_at_ttl")
    except Exception:
        pass
    await database.db.emails.create_index(
        "created_at",
        expireAfterSeconds=seconds,
        name="created_at_ttl",
    )
    return record


async def get_telegram_settings() -> TelegramSettings:
    doc = await database.db.settings.find_one({"key": "telegram"})
    if doc:
        return TelegramSettings(
            enabled=doc.get("enabled", False),
            bot_token=doc.get("bot_token", ""),
            chat_id=doc.get("chat_id", ""),
            allowed_domains=doc.get("allowed_domains", []),
            updated_at=doc.get("updated_at", _now()),
        )
    return TelegramSettings(
        enabled=False,
        bot_token="",
        chat_id="",
        allowed_domains=[],
        updated_at=_now(),
    )


async def set_telegram_settings(settings: TelegramSettings) -> TelegramSettings:
    await database.db.settings.update_one(
        {"key": "telegram"},
        {
            "$set": {
                "enabled": settings.enabled,
                "bot_token": settings.bot_token,
                "chat_id": settings.chat_id,
                "allowed_domains": settings.allowed_domains,
                "updated_at": settings.updated_at,
            }
        },
        upsert=True,
    )
    return settings


async def create_admin_session(token: str, max_age_seconds: int) -> None:
    expires_at = _now() + timedelta(seconds=max_age_seconds)
    await database.db.sessions.insert_one(
        {
            "token": token,
            "created_at": _now(),
            "expires_at": expires_at,
        }
    )


async def is_admin_session_valid(token: Optional[str]) -> bool:
    if not token:
        return False
    doc = await database.db.sessions.find_one({"token": token})
    return doc is not None


async def get_admin_stats() -> AdminStats:
    inboxes = await database.db.emails.distinct("address")
    inbox_count = len(inboxes)
    message_count = await database.db.emails.count_documents({})
    latest_doc = await database.db.emails.find().sort("created_at", -1).limit(1).to_list(1)
    latest_received_at = latest_doc[0]["created_at"] if latest_doc else None
    return AdminStats(
        inbox_count=inbox_count,
        message_count=message_count,
        latest_received_at=latest_received_at,
    )


async def get_domain_expiration(domain: str) -> Optional[dict]:
    return await database.db.domain_expirations.find_one({"domain": domain.lower()})


async def upsert_domain_expiration(domain: str, expires_at: Optional[str]) -> dict:
    record = {
        "domain": domain.lower(),
        "expires_at": expires_at,
        "checked_at": _now(),
    }
    await database.db.domain_expirations.update_one(
        {"domain": domain.lower()},
        {"$set": record},
        upsert=True,
    )
    return record
