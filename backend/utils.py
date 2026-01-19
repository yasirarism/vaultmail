from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from typing import Optional


EMAIL_REGEX = re.compile(r"([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)")


@dataclass
class SenderInfo:
    name: str
    email: Optional[str]
    label: str


def extract_email(text: str) -> Optional[str]:
    match = EMAIL_REGEX.search(text)
    return match.group(1).lower() if match else None


def get_sender_info(value: str) -> SenderInfo:
    email = extract_email(value)
    trimmed = value.strip()
    angle_index = trimmed.find("<")
    raw_name = trimmed[:angle_index].strip() if angle_index != -1 else ""
    cleaned_name = raw_name.strip("'\"").strip()
    fallback = trimmed.strip("'\"").strip()
    name = cleaned_name or fallback or email or value
    if email and cleaned_name and cleaned_name != email:
        label = f"{cleaned_name} <{email}>"
    elif email and not cleaned_name and fallback and fallback != email:
        label = f"{fallback} <{email}>"
    else:
        label = name
    return SenderInfo(name=name, email=email, label=label)


def sanitize_filename(value: str, fallback: str) -> str:
    safe = re.sub(r"[^a-z0-9-_.]+", "_", value, flags=re.IGNORECASE)
    safe = safe.strip("_")[:60]
    return safe or fallback


def html_to_text(value: str) -> str:
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def build_eml_content(
    *, from_address: str, to_address: str, subject: str, received_at: str, text: str, html: str
) -> tuple[str, str]:
    text_body = text.strip() if text else ""
    html_body = html.strip() if html else ""
    use_html = bool(html_body)
    body = html_body if use_html else text_body or (html_to_text(html_body) if html_body else "")
    content_type = "text/html" if use_html else "text/plain"
    content = "\n".join(
        [
            f"From: {from_address}",
            f"To: {to_address}",
            f"Subject: {subject}",
            f"Date: {received_at}",
            "MIME-Version: 1.0",
            f"Content-Type: {content_type}; charset=utf-8",
            "",
            body,
        ]
    )
    return content, content_type


def estimate_base64_bytes(value: Optional[str]) -> int:
    if not value:
        return 0
    normalized = re.sub(r"\s+", "", value.strip())
    padding = 2 if normalized.endswith("==") else 1 if normalized.endswith("=") else 0
    return max(0, int(len(normalized) * 3 / 4) - padding)


def decode_base64(value: str) -> bytes:
    return base64.b64decode(value)


def encode_base64(value: bytes) -> str:
    return base64.b64encode(value).decode("utf-8")
