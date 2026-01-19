from datetime import datetime, timezone
from typing import Optional
import base64
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from backend.config import get_settings
from backend.db import database
from backend.models import EmailIn, InboxResponse, RetentionResponse, WebhookResponse
from backend.storage import fetch_email, fetch_inbox, mark_read, store_email

app = FastAPI(title="VaultMail API", version="2.0.0")


@app.on_event("startup")
async def startup() -> None:
    await database.init_indexes()


@app.get("/api/inbox", response_model=InboxResponse)
async def get_inbox(address: str = Query(..., min_length=3)) -> InboxResponse:
    emails = await fetch_inbox(address)
    return InboxResponse(emails=emails)


@app.post("/api/webhook", response_model=WebhookResponse)
async def webhook(payload: EmailIn) -> WebhookResponse:
    stored_id = await store_email(payload)
    return WebhookResponse(success=True, id=stored_id)


@app.get("/api/download")
async def download(
    address: str = Query(...),
    email_id: str = Query(..., alias="emailId"),
    download_type: str = Query("email", alias="type"),
    index: Optional[int] = Query(None),
) -> Response:
    email = await fetch_email(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    if email.get("address") != address.lower():
        raise HTTPException(status_code=403, detail="Address mismatch")

    await mark_read(email_id)

    if download_type == "attachment":
        attachments = email.get("attachments", [])
        if index is None or index >= len(attachments):
            raise HTTPException(status_code=404, detail="Attachment not found")
        attachment = attachments[index]
        content = base64.b64decode(attachment.get("content_base64", ""))
        return Response(
            content=content,
            media_type=attachment.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f"attachment; filename={attachment.get('filename', 'attachment')}"
            },
        )

    payload = {
        "from": email.get("from"),
        "to": email.get("to"),
        "subject": email.get("subject"),
        "text": email.get("text"),
        "html": email.get("html"),
        "receivedAt": email.get("created_at"),
    }
    return JSONResponse(payload)


@app.get("/api/retention", response_model=RetentionResponse)
async def retention() -> RetentionResponse:
    settings = get_settings()
    return RetentionResponse(seconds=settings.retention_seconds, updated_at=datetime.now(timezone.utc))
