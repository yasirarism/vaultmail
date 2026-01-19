from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Attachment(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    filename: str
    content_type: Optional[str] = Field(
        default=None, validation_alias="contentType", serialization_alias="contentType"
    )
    content_base64: Optional[str] = Field(
        default=None, validation_alias="contentBase64", serialization_alias="contentBase64"
    )
    omitted: bool = False
    size: Optional[int] = None


class EmailIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_address: str = Field(alias="from")
    to_address: str = Field(alias="to")
    subject: str = "(No Subject)"
    text: Optional[str] = None
    html: Optional[str] = None
    attachments: List[Attachment] = Field(default_factory=list)


class EmailOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    id: str
    from_address: str = Field(serialization_alias="from")
    to_address: str = Field(serialization_alias="to")
    subject: str
    text: Optional[str]
    html: Optional[str]
    attachments: List[Attachment]
    received_at: datetime = Field(serialization_alias="receivedAt")
    read: bool


class InboxResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    emails: List[EmailOut]


class RetentionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    seconds: int
    updated_at: datetime = Field(serialization_alias="updatedAt")


class WebhookResponse(BaseModel):
    success: bool
    id: str


class RetentionSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    seconds: int
    updated_at: datetime = Field(serialization_alias="updatedAt")


class TelegramSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    enabled: bool
    bot_token: str = Field(serialization_alias="botToken")
    chat_id: str = Field(serialization_alias="chatId")
    allowed_domains: List[str] = Field(default_factory=list, serialization_alias="allowedDomains")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class AdminStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    inbox_count: int = Field(serialization_alias="inboxCount")
    message_count: int = Field(serialization_alias="messageCount")
    latest_received_at: Optional[datetime] = Field(
        default=None, serialization_alias="latestReceivedAt"
    )
