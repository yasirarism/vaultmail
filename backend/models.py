from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Attachment(BaseModel):
    filename: str
    content_type: str
    content_base64: str


class EmailIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_address: str = Field(alias="from")
    to_address: str = Field(alias="to")
    subject: str
    text: Optional[str] = None
    html: Optional[str] = None
    attachments: List[Attachment] = Field(default_factory=list)


class EmailOut(BaseModel):
    id: str
    from_address: str
    to_address: str
    subject: str
    text: Optional[str]
    html: Optional[str]
    attachments: List[Attachment]
    received_at: datetime
    read: bool


class InboxResponse(BaseModel):
    emails: List[EmailOut]


class RetentionResponse(BaseModel):
    seconds: int
    updated_at: datetime


class WebhookResponse(BaseModel):
    success: bool
    id: str
