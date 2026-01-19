# VaultMail - FastAPI + MongoDB

VaultMail is a privacy-focused disposable email backend rewritten in **FastAPI** with **MongoDB** persistence. It supports inbox retrieval, webhook ingestion, attachment downloads, and retention policies with TTL indexes.

## ✨ Features

- **FastAPI API** with typed responses.
- **MongoDB storage** with TTL indexes for automatic retention cleanup.
- **Docker-first** deployment (API + MongoDB).

## 🧱 Architecture

1. Email routing service (Cloudflare/Mailgun/etc) sends JSON payloads to `/api/webhook`.
2. FastAPI validates and stores messages in MongoDB.
3. Inbox listing and downloads are served from `/api/inbox` and `/api/download`.

## 🚀 Local Development

### 1) Start with Docker Compose

```bash
docker compose up --build
```

API is available at `http://localhost:8000`.

### 2) Run API locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DB="vaultmail"
export RETENTION_SECONDS=86400
uvicorn backend.main:app --reload
```

## 🔧 Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://mongo:27017` | MongoDB connection string |
| `MONGODB_DB` | `vaultmail` | Database name |
| `RETENTION_SECONDS` | `86400` | Retention window in seconds |

## 📚 API Documentation

### 1) Fetch Inbox

**Endpoint**
```
GET /api/inbox?address=nama@domain.com
```

**Response**
```json
{
  "emails": [
    {
      "id": "uuid",
      "from_address": "sender@example.com",
      "to_address": "nama@domain.com",
      "subject": "Hello",
      "text": "Plain text",
      "html": "<p>Plain text</p>",
      "attachments": [],
      "received_at": "2025-01-01T00:00:00.000Z",
      "read": false
    }
  ]
}
```

### 2) Webhook (Inbound Email)

**Endpoint**
```
POST /api/webhook
```

**JSON Body Example**
```json
{
  "from": "sender@example.com",
  "to": "nama@domain.com",
  "subject": "Hello",
  "text": "Plain text message",
  "html": "<p>Plain text message</p>",
  "attachments": [
    {
      "filename": "hello.txt",
      "content_type": "text/plain",
      "content_base64": "SGVsbG8h"
    }
  ]
}
```

**Response**
```json
{ "success": true, "id": "uuid" }
```

### 3) Download Email / Attachment

**Endpoint**
```
GET /api/download?address=nama@domain.com&emailId=uuid&type=email
GET /api/download?address=nama@domain.com&emailId=uuid&type=attachment&index=0
```

### 4) Retention Settings

**Endpoint**
```
GET /api/retention
```

**Response**
```json
{
  "seconds": 86400,
  "updated_at": "2025-01-01T00:00:00.000Z"
}
```

## 📜 License

MIT License.
