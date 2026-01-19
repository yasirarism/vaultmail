from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
import httpx
from fastapi import Cookie, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
from backend.config import get_settings
from backend.db import database
from backend.models import (
    AdminStats,
    EmailIn,
    InboxResponse,
    RetentionResponse,
    RetentionSettings,
    TelegramSettings,
    WebhookResponse,
)
from backend.storage import (
    create_admin_session,
    fetch_email,
    fetch_inbox,
    get_admin_stats,
    get_domain_expiration,
    get_retention_settings,
    get_telegram_settings,
    is_admin_session_valid,
    mark_read,
    set_retention_settings,
    set_telegram_settings,
    store_email,
    upsert_domain_expiration,
)
from backend.utils import (
    build_eml_content,
    decode_base64,
    encode_base64,
    estimate_base64_bytes,
    extract_email,
    get_sender_info,
    sanitize_filename,
)

app = FastAPI(title="VaultMail API", version="2.0.0")
ADMIN_SESSION_COOKIE = "vaultmail_admin_session"
ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7
TELEGRAM_MESSAGE_LIMIT = 4000


@app.on_event("startup")
async def startup() -> None:
    await database.init_indexes()


@app.get("/api/inbox", response_model=InboxResponse)
async def get_inbox(address: str = Query(..., min_length=3)) -> InboxResponse:
    emails = await fetch_inbox(address)
    return InboxResponse(emails=emails)


@app.post("/api/webhook", response_model=WebhookResponse)
async def webhook(request: Request) -> WebhookResponse:
    settings = get_settings()
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
        try:
            payload = EmailIn.model_validate(body)
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        attachments = payload.attachments
        normalized = []
        for attachment in attachments:
            size = attachment.size or estimate_base64_bytes(attachment.content_base64)
            omitted = size > settings.attachment_max_bytes
            normalized.append(
                attachment.model_copy(
                    update={
                        "size": size,
                        "omitted": omitted,
                        "content_base64": None if omitted else attachment.content_base64,
                    }
                )
            )
        html = payload.html or payload.text or ""
        payload = payload.model_copy(update={"attachments": normalized, "html": html})
    elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        from_address = str(form.get("from") or "")
        to_address = str(form.get("to") or form.get("recipient") or "")
        subject = str(form.get("subject") or "")
        text = str(form.get("text") or form.get("body-plain") or "")
        html = str(form.get("html") or form.get("body-html") or "")
        attachments = []
        for _, value in form.multi_items():
            if hasattr(value, "filename"):
                file_size = getattr(value, "size", None)
                data = await value.read()
                size = file_size if file_size is not None else len(data)
                omitted = size > settings.attachment_max_bytes
                attachments.append(
                    {
                        "filename": value.filename or "attachment",
                        "contentType": value.content_type or "application/octet-stream",
                        "size": size,
                        "omitted": omitted,
                        "contentBase64": None if omitted else encode_base64(data),
                    }
                )
        payload = EmailIn(
            **{
                "from": from_address,
                "to": to_address,
                "subject": subject or "(No Subject)",
                "text": text or "",
                "html": html or text or "",
                "attachments": attachments,
            }
        )
    else:
        raise HTTPException(status_code=415, detail="Unsupported Content-Type")

    if not payload.to_address or not payload.from_address:
        raise HTTPException(status_code=400, detail="Missing parameters")

    clean_to = extract_email(payload.to_address)
    if not clean_to:
        raise HTTPException(status_code=400, detail="Invalid recipient")

    payload = payload.model_copy(update={"to_address": clean_to})
    stored_id = await store_email(payload)

    await send_telegram_notification(
        from_address=payload.from_address,
        to_address=payload.to_address,
        subject=payload.subject or "(No Subject)",
        text=payload.text or "",
    )

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
        if attachment.get("omitted"):
            raise HTTPException(status_code=413, detail="Attachment too large to download")
        if not attachment.get("content_base64"):
            raise HTTPException(status_code=404, detail="Attachment not found")
        content = decode_base64(attachment.get("content_base64", ""))
        filename = sanitize_filename(attachment.get("filename", "attachment"), "attachment")
        return Response(
            content=content,
            media_type=attachment.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            },
        )

    if download_type == "email":
        subject = email.get("subject") or "(No Subject)"
        received_at = email.get("created_at")
        content, content_type = build_eml_content(
            from_address=email.get("from", ""),
            to_address=email.get("to", ""),
            subject=subject,
            received_at=received_at.strftime("%a, %d %b %Y %H:%M:%S %z")
            if received_at
            else "",
            text=email.get("text") or "",
            html=email.get("html") or "",
        )
        filename = sanitize_filename(subject, "email")
        return Response(
            content=content,
            media_type=f"message/rfc822; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.eml"'},
        )

    return JSONResponse({"error": "Invalid download type"}, status_code=400)


@app.get("/api/retention", response_model=RetentionResponse)
async def retention() -> RetentionResponse:
    settings = get_settings()
    stored = await get_retention_settings(settings.retention_seconds)
    return RetentionResponse(seconds=stored.seconds, updated_at=stored.updated_at)


@app.post("/api/settings", response_model=RetentionSettings)
async def update_settings(
    request: Request, session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE)
) -> RetentionSettings:
    if not await is_admin_session_valid(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()
    retention_seconds = body.get("retentionSeconds")
    if not retention_seconds:
        raise HTTPException(status_code=400, detail="Missing fields")
    return await set_retention_settings(int(retention_seconds))


@app.post("/api/admin/auth")
async def admin_auth(request: Request) -> Response:
    settings = get_settings()
    body = await request.json()
    password = body.get("password")
    if not settings.admin_password or password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = str(uuid4())
    await create_admin_session(token, ADMIN_SESSION_MAX_AGE)
    response = JSONResponse({"success": True})
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=ADMIN_SESSION_MAX_AGE,
    )
    return response


@app.get("/api/admin/retention", response_model=RetentionSettings)
async def get_admin_retention(
    session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE)
) -> RetentionSettings:
    if not await is_admin_session_valid(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    settings = get_settings()
    return await get_retention_settings(settings.retention_seconds)


@app.post("/api/admin/retention", response_model=RetentionSettings)
async def update_admin_retention(
    request: Request, session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE)
) -> RetentionSettings:
    if not await is_admin_session_valid(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()
    seconds = int(body.get("seconds") or 0)
    if not seconds:
        raise HTTPException(status_code=400, detail="Missing fields")
    return await set_retention_settings(seconds)


@app.get("/api/admin/telegram", response_model=TelegramSettings)
async def get_admin_telegram(
    session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE)
) -> TelegramSettings:
    if not await is_admin_session_valid(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await get_telegram_settings()


@app.post("/api/admin/telegram", response_model=TelegramSettings)
async def update_admin_telegram(
    request: Request, session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE)
) -> TelegramSettings:
    if not await is_admin_session_valid(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    body = await request.json()
    allowed_domains = body.get("allowedDomains") or []
    allowed_domains = [str(domain).lower().strip() for domain in allowed_domains if str(domain).strip()]
    settings = TelegramSettings(
        enabled=bool(body.get("enabled")),
        bot_token=str(body.get("botToken") or "").strip(),
        chat_id=str(body.get("chatId") or "").strip(),
        allowed_domains=allowed_domains,
        updated_at=datetime.now(timezone.utc),
    )
    return await set_telegram_settings(settings)


@app.get("/api/admin/stats", response_model=AdminStats)
async def admin_stats(
    session_token: Optional[str] = Cookie(default=None, alias=ADMIN_SESSION_COOKIE)
) -> AdminStats:
    if not await is_admin_session_valid(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await get_admin_stats()


@app.get("/api/domain-expiration")
async def domain_expiration(domain: str = Query(...)) -> Response:
    record = await get_domain_expiration(domain)
    if record:
        checked_at = record.get("checked_at")
        if checked_at:
            age_hours = (datetime.now(timezone.utc) - checked_at).total_seconds() / 3600
            if age_hours < 24:
                return JSONResponse(
                    {
                        "domain": record.get("domain"),
                        "expiresAt": record.get("expires_at"),
                        "checkedAt": checked_at.isoformat(),
                    }
                )
    refreshed = await refresh_domain_expiration(domain)
    return JSONResponse(refreshed)


@app.get("/api/cron/domain-expiration")
async def cron_domain_expiration(request: Request) -> Response:
    settings = get_settings()
    if settings.cron_secret:
        header = request.headers.get("x-cron-secret")
        if header != settings.cron_secret:
            raise HTTPException(status_code=401, detail="Unauthorized")
    results = []
    for domain in settings.default_domains:
        results.append(await refresh_domain_expiration(domain))
    return JSONResponse({"updated": len(results), "domains": results})


async def refresh_domain_expiration(domain: str) -> dict:
    expires_at = await fetch_expiration(domain)
    record = await upsert_domain_expiration(domain, expires_at)
    return {
        "domain": record.get("domain"),
        "expiresAt": record.get("expires_at"),
        "checkedAt": record.get("checked_at").isoformat(),
    }


async def fetch_expiration(domain: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://whois-search.vercel.app/api/lookup", params={"query": domain}
            )
            if response.status_code != 200:
                return None
            data = response.json()
            expiration_raw = data.get("result", {}).get("expirationDate")
            if not expiration_raw:
                return None
            parsed = datetime.fromisoformat(expiration_raw.replace("Z", "+00:00"))
            return parsed.isoformat()
    except Exception:
        return None


async def send_telegram_notification(
    *, from_address: str, to_address: str, subject: str, text: str
) -> None:
    settings = await get_telegram_settings()
    if not settings.enabled or not settings.bot_token or not settings.chat_id:
        return

    if settings.allowed_domains:
        recipient = extract_email(to_address)
        domain = recipient.split("@")[-1].lower() if recipient else ""
        if not domain or domain not in settings.allowed_domains:
            return

    sender = get_sender_info(from_address)
    message_lines = [
        "📬 New Inbox Message",
        f"From: {sender.label}",
        f"To: {to_address}",
        f"Subject: {subject}",
        "",
        text,
    ]
    payload = {
        "chat_id": settings.chat_id,
        "text": "\n".join(message_lines)[:TELEGRAM_MESSAGE_LIMIT],
        "disable_web_page_preview": True,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.bot_token}/sendMessage",
                json=payload,
            )
            if response.status_code != 200:
                response.read()
    except Exception:
        return
