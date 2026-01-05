# VaultMail - Serverless Disposable Mail

A premium, disposable email service deployed on Vercel with support for custom domains.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

-   **Zero Server Maintenance**: Runs entirely on Vercel (Next.js + Upstash Redis).
-   **Custom Domains**: Bring your own domain via Mailgun, SendGrid, or Cloudflare.
-   **Real-time**: Inbox auto-refreshes.
-   **Privacy Focused**: Emails stored in Redis with a 24-hour TTL (Auto-expiry).
-   **Premium UI**: Glassmorphism, Dark Mode, and Responsive design.

## Architecture

1.  **Incoming Mail**: DNS MX Records point to your email provider (e.g., Mailgun of Cloudflare).
2.  **Webhook**: Provider receives email, parses it, and POSTs JSON to `https://your-app.vercel.app/api/webhook`.
3.  **Storage**: App stores email in **Upstash Redis** (via Vercel Marketplace).
4.  **UI**: User polls the API to see emails for their generated address.

## Deployment Guide

### 1. Deploy to Vercel

Clone this repository and deploy it to Vercel.

### 2. Configure Database (Upstash Redis)

1.  Go to the **Storage** tab in your Vercel Project.
2.  Click **Connect Store** and select **Upstash Redis** from the Marketplace.
3.  Link it to your project. This will automatically set environment variables like `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
    *   *Note*: If you created the database manually on Upstash console, copy these variables to your Vercel Environment Variables.

### 3. Configure Email Receiving (The Custom Domain Part)

Since Vercel does not accept SMTP traffic directly, you need a service to receive the email and forward it to your app via Webhook.

#### Option A: Cloudflare Email Workers (Free & Recommended)
We have included a pre-configured worker in the `worker/` directory.

1.  **Setup Cloudflare**:
    *   Add your domain to Cloudflare.
    *   Enable **Email Routing** in the Cloudflare Dashboard.

2.  **Deploy the Worker**:
    *   `cd worker`
    *   `npm install`
    *   Open `src/index.js` and update `const TARGET_URL` to your deployed Vercel app URL (e.g., `https://your-project.vercel.app/api/webhook`).
    *   `npm run deploy`

3.  **Route Emails to Worker**:
    *   In Cloudflare Email Routing > **Routes**.
    *   Create a "Catch-All" route (Action: `Send to Worker`, Destination: `dispomail-forwarder`).

#### Option B: Mailgun
1.  Add your domain to Mailgun and configure MX records.
2.  Create a Route in Mailgun:
    *   **Expression**: `Match Recipient` -> `(.*)@yourdomain.com`
    *   **Actions**: `Forward` -> `https://your-project.vercel.app/api/webhook`

## Local Development

1.  `npm install`
2.  **Env Setup**: Copy your Upstash Redis credentials to `.env.local`:
    ```env
    UPSTASH_REDIS_REST_URL="your-url"
    UPSTASH_REDIS_REST_TOKEN="your-token"
    ```
3.  `npm run dev`
