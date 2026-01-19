# VaultMail - FastAPI + MongoDB

VaultMail is a privacy-focused disposable email backend rewritten in **FastAPI** with **MongoDB** persistence. It supports inbox retrieval, webhook ingestion, attachment downloads, and retention policies with TTL indexes.

## ✨ Features

- **FastAPI API** with typed responses.
- **MongoDB storage** with TTL indexes for automatic retention cleanup.
- **Admin endpoints** for retention, Telegram notifications, and stats.
- **Domain expiration** checks with cached WHOIS lookups.
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
| `RETENTION_SECONDS` | `86400` | Default retention window in seconds |
| `ADMIN_PASSWORD` | _(empty)_ | Admin login password |
| `ATTACHMENT_MAX_BYTES` | `2000000` | Max attachment bytes allowed before omission |
| `CRON_SECRET` | _(empty)_ | Optional secret for cron endpoint |
| `DEFAULT_DOMAINS` | `ysweb.biz.id` | Default domains for cron expiration checks |

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
      "from": "sender@example.com",
      "to": "nama@domain.com",
      "subject": "Hello",
      "text": "Plain text",
      "html": "<p>Plain text</p>",
      "attachments": [],
      "receivedAt": "2025-01-01T00:00:00.000Z",
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
      "contentType": "text/plain",
      "contentBase64": "SGVsbG8h"
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

### 5) Admin Auth

**Endpoint**
```
POST /api/admin/auth
```

**JSON Body**
```json
{ "password": "your-admin-password" }
```

### 6) Admin Retention

**Endpoints**
```
GET /api/admin/retention
POST /api/admin/retention
```

**POST Body**
```json
{ "seconds": 86400 }
```

### 7) Admin Telegram

**Endpoints**
```
GET /api/admin/telegram
POST /api/admin/telegram
```

**POST Body**
```json
{
  "enabled": true,
  "botToken": "TOKEN",
  "chatId": "CHAT_ID",
  "allowedDomains": ["example.com"]
}
```

### 8) Admin Stats

**Endpoint**
```
GET /api/admin/stats
```

### 9) Domain Expiration

**Endpoints**
```
GET /api/domain-expiration?domain=example.com
GET /api/cron/domain-expiration
```

## 📜 License

MIT License.
