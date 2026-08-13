# VaultMail - Private, Serverless Disposable Mail

![VaultMail Banner](public/readme-banner.png)

A premium, privacy-focused disposable email service built with **Next.js** and **MongoDB**. Features real-time inbox updates, custom domain support, and configurable privacy settings.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248) ![Cloudflare](https://img.shields.io/badge/Cloudflare-D1-F38020)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yasirarism/vaultmail)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yasirarism/vaultmail&env=MONGODB_URI,ADMIN_PASSWORD&envDescription=MongoDB%20connection%20string%20and%20admin%20password)

## ✨ Features

-   **🛡️ Privacy First**: Emails are stored in short-lived MongoDB records with auto-expiry logic.
-   **⚙️ Configurable Retention**: Users can set email lifespan from **30 minutes** to **1 week**.
-   **🌐 Custom Domains**: Bring your own domain via Cloudflare or Mailgun (Manage Domains GUI included).
-   **⚡ Real-time**: Instant email delivery and inbox updates.
-   **🎨 Premium UI**: Glassmorphism aesthetic, Dark Mode, and responsive mobile design.
-   **📜 History**: Locally stored history of generated addresses for quick access.
-   **🔗 Pretty URLs**: Shareable links like `https://app.com/user@domain.com`.

## 🏗️ Architecture

1.  **Incoming Mail**: DNS MX Records point to your email routing service (Cloudflare/Mailgun).
2.  **Webhook**: The service forwards the raw email to `https://your-app.com/api/webhook`.
3.  **Processing**: The app parses the email, checks user retention settings, and stores it in **MongoDB**.
4.  **Frontend**: The Next.js UI polls the API to display emails for the current address.

## 🚀 Deployment Guide

VaultMail supports two backends:

| Platform | Database | IMAP | Incoming mail |
| --- | --- | --- | --- |
| Cloudflare Pages / Workers | **D1** | Disabled (use webhook) | Cloudflare Email Routing worker |
| Vercel / Docker / VPS | **MongoDB** | Optional | Webhook and/or IMAP |

`next build` / `next start` and the Dockerfile stay on MongoDB. Cloudflare uses `npm run cf:deploy` and never requires `MONGODB_URI`.

### A. One-click: Cloudflare Pages / Workers (D1)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yasirarism/vaultmail)

1. Click **Deploy to Cloudflare**.
2. Create a D1 database named `vaultmail`, then bind it as `DB`:
   ```bash
   npx wrangler d1 create vaultmail
   ```
   Put the returned `database_id` into `wrangler.jsonc`.
3. Apply schema (optional — tables are also created on first request):
   ```bash
   npx wrangler d1 migrations apply vaultmail --remote
   ```
4. Set Worker secrets / vars:
   * `ADMIN_PASSWORD`
   * `STORAGE_DRIVER=d1` (already set in `wrangler.jsonc`)
5. Deploy:
   ```bash
   npm run cf:deploy
   ```
6. Point the email worker `WEBHOOK_URL` to `https://<your-app>.workers.dev/api/webhook`.

IMAP is intentionally off on Cloudflare (TCP IMAP is slow and unsupported). Use the included Email Routing worker.

### B. Vercel / Docker / VPS (MongoDB)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yasirarism/vaultmail&env=MONGODB_URI,ADMIN_PASSWORD&envDescription=MongoDB%20connection%20string%20and%20admin%20password)

### 1. Deploy to Vercel

Clone this repository and deploy it to Vercel. Keep using `npm run build` / the default Vercel Next.js preset.

### 2. Configure Database (MongoDB)

Provision a MongoDB database (MongoDB Atlas or self-hosted) and set the connection string in Vercel:

*   `MONGODB_URI`
*   `MONGODB_DB` (optional, defaults to `vaultmail`)
*   `STORAGE_DRIVER=mongo` (optional; auto-selected when `MONGODB_URI` is set outside Cloudflare)

### 3. Configure Email Forwarding

You need a service to receive SMTP traffic and forward it to your app's webhook.

#### Recommended: Cloudflare Email Workers (Free)
We include a pre-configured worker in the `worker/` directory.

1.  **Setup Cloudflare**:
    *   Add your domain to Cloudflare.
    *   Enable **Email Routing** in the Cloudflare Dashboard.

2.  **Deploy the Worker**:
    ```bash
    cd worker
    npm install
    # Configure worker environment variables in Cloudflare (or via wrangler)
    # Required:
    #   WEBHOOK_URL=https://your-vercel-app.vercel.app/api/webhook
    # Optional (forward specific domains to a verified Email Routing address):
    #   FORWARD_DOMAINS=example.com,anotherdomain.com
    #   FORWARD_EMAIL=verified@yourdomain.com
    npm run deploy
    ```

3.  **Route Emails**:
    *   In Cloudflare Email Routing > **Routes**.
    *   Create a "Catch-All" route.
    *   Action: `Send to Worker` -> Destination: `dispomail-forwarder` (or whatever you named it).

4.  **Optional: GitHub Actions Deploy**:
    *   Set repository secrets:
        *   `CLOUDFLARE_API_TOKEN`
        *   `CLOUDFLARE_ACCOUNT_ID`
        *   `WEBHOOK_URL` (required)
        *   `FORWARD_DOMAINS` (optional)
        *   `FORWARD_EMAIL` (optional)
    *   Pushing changes under `worker/` will trigger `.github/workflows/worker-deploy.yml`.
    *   The workflow syncs the listed secrets on deploy so values stay consistent across redeploys.



### 4. Alternative: IMAP Fetch Setup (Admin Dashboard)

Selain webhook, Anda juga bisa menarik email langsung dari akun IMAP (misalnya Gmail) lewat **Admin Dashboard**.

#### A. Buka pengaturan IMAP di admin
1. Login ke `/admin`.
2. Cari section **IMAP Fetch**.
3. Isi parameter berikut lalu klik **Simpan IMAP**:
   - `Host`: server IMAP (contoh Gmail: `imap.gmail.com`)
   - `Port`: biasanya `993`
   - `User`: email login IMAP
   - `Password`: password IMAP / app password
   - `Mailbox`: biasanya `INBOX`
   - `Max Fetch`: jumlah email terakhir yang di-scan per request inbox
   - `Domain Filter` (opsional): batasi hanya domain tertentu
4. Aktifkan toggle **Aktif** pada IMAP Fetch.

#### B. Contoh setup Gmail (disarankan pakai App Password)
> Catatan: untuk Gmail, password akun biasa sering ditolak untuk IMAP. Gunakan App Password.

1. Buka akun Google yang mau dipakai menerima email.
2. Pastikan **2-Step Verification** sudah aktif.
3. Buat **App Password** dari halaman keamanan Google.
4. Gunakan konfigurasi berikut di Admin Dashboard:
   - Host: `imap.gmail.com`
   - Port: `993`
   - User: `namaakun@gmail.com`
   - Password: *16-digit App Password* (tanpa spasi)
   - Mailbox: `INBOX`
   - Max Fetch: contoh `30`
5. Simpan, aktifkan IMAP, lalu buka inbox target di aplikasi.

#### C. Cara kerjanya
- Saat frontend memanggil `GET /api/inbox?address=...`, server akan:
  1. load email existing,
  2. pull email terbaru dari IMAP (jika aktif),
  3. deduplicate berdasarkan `sourceId`,
  4. simpan ke inbox storage yang sama dengan webhook.
- Artinya mode webhook lama **tetap jalan**; IMAP adalah jalur alternatif/tambahan.

## 🛠️ Local Development

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Create `.env.local` and add your MongoDB credentials:
    ```env
    MONGODB_URI="your-connection-string"
    MONGODB_DB="vaultmail"
    # Optional: force a storage backend (mongo outside Cloudflare, d1 on Cloudflare)
    STORAGE_DRIVER="mongo"
    # Optional: enable Google AdSense auto ads
    NEXT_PUBLIC_ADSENSE_CLIENT_ID="ca-pub-xxxxxxxxxxxxxxxx"
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 📚 API Documentation (Temporary Email)

### 1) Fetch Inbox

Ambil daftar email untuk alamat sementara.

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

Email routing service (Cloudflare/Mailgun) mengirim email ke endpoint ini.

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
  "attachments": []
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

### 4) Retention Settings (Read Only)

**Endpoint**
```
GET /api/retention
```

**Response**
```json
{
  "seconds": 86400,
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

## 📜 License

MIT License. Feel free to fork and deploy your own private email shield.
