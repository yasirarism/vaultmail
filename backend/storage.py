from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from backend.db import database
from backend.models import Attachment, EmailIn, EmailOut


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_email(doc: dict) -> EmailOut:
    return EmailOut(
        id=str(doc["_id"]),
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
    doc = {
        "from": payload.from_address,
        "to": payload.to_address,
        "address": payload.to_address.lower(),
        "subject": payload.subject,
        "text": payload.text,
        "html": payload.html,
        "attachments": [a.model_dump() for a in payload.attachments],
        "created_at": _now(),
        "read": False,
    }
    result = await database.db.emails.insert_one(doc)
    return str(result.inserted_id)


async def fetch_inbox(address: str) -> List[EmailOut]:
    cursor = database.db.emails.find({"address": address.lower()}).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return [_serialize_email(doc) for doc in docs]


async def fetch_email(email_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(email_id):
        return None
    return await database.db.emails.find_one({"_id": ObjectId(email_id)})


async def mark_read(email_id: str) -> None:
    if ObjectId.is_valid(email_id):
        await database.db.emails.update_one(
            {"_id": ObjectId(email_id)},
            {"$set": {"read": True}},
        )
