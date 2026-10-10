# Yasirmail

Temporary email service with disposable inboxes. Built with Next.js.

## Features

- **Temporary email addresses** — generate and use disposable inboxes
- **Multiple domains** — bring your own domain or use defaults
- **IMAP support** — optional IMAP inbox polling
- **Webhook** — receive emails via webhook
- **Theme system** — 3 themes: Neo Brutal (default), Glassmorphism, Neomorph
- **Starfield background** — twinkling stars + shooting stars (theme-aware)
- **API key support** — GitHub or Google OAuth login → generate API keys → OpenAI-style API

## Architecture

The system is **separated** into two distinct API layers:

### Internal API (Web UI)
- `/api/inbox`, `/api/download`, `/api/retention` — used by the frontend
- Accessible via session cookie (anonymous for temp mail, no API key required)
- The web UI never holds or exposes API keys

### Public API (Developers)
- `/api/v1/inbox`, `/api/v1/download`, `/api/v1/retention` — for external developers
- **Requires API key** via `Authorization: Bearer <key>` header (OpenAI-style)
- Rate limiting: implement as needed (recommended)

## API Key System

1. **Login with GitHub or Google** at `/api-access`
2. **Generate API key** — visible exactly once (`vm-xxx...`)
3. **Use API key** — pass in `Authorization: Bearer vm-xxx...` header
4. **Revoke** — delete keys from the API access page

### Example

```bash
curl -H "Authorization: Bearer vm-xxx..." \
  https://yourdomain.com/api/v1/inbox?address=nama@domain.com
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth App client secret |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `APP_URL` | No | Public base URL (auto-detect if not set) |
| `REQUIRE_API_KEY` | No | Set to `1` to require keys on public API |

### GitHub OAuth Setup

1. Go to [GitHub OAuth Apps](https://github.com/settings/developers) → New OAuth App
2. **Homepage URL**: `https://yourdomain.com`
3. **Callback URL**: `https://yourdomain.com/api/auth/github/callback`
4. Create the app, copy Client ID and Secret
5. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in:
   - Environment variables, or
   - Admin panel → API & Integrations (recommended)

### Google OAuth Setup

You need a Google Cloud project. The free tier is enough — this flow only reads the
user's basic profile (`openid email profile`) and costs nothing.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a
   project (or pick an existing one).
2. Configure the consent screen: **Google Auth Platform → Branding** (older consoles:
   *APIs & Services → OAuth consent screen*)
   - **User type**: `External` (use `Internal` only if you are on Google Workspace and
     want to restrict login to your own organisation)
   - **App name**, **User support email**, **Developer contact email** — required
   - **Scopes**: add `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
     These two are enough; do not add sensitive scopes.
   - **Publish the app**: go to **Google Auth Platform → Audience** and click
     **Publish app** so the publishing status becomes *In production*.
     **You do NOT need to add test users.** `openid`, `email` and `profile` are all
     *non-sensitive* scopes, so Google requires no verification review and the app
     publishes immediately. While the status is *Testing*, only accounts listed under
     *Test users* can sign in (hard cap of 100) — fine for your own testing, but it
     blocks real users.
   - Optional: *brand verification* is only needed to show your app's name and logo on
     the consent screen instead of the project's domain. Purely cosmetic — login works
     without it.
3. Create the client: **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - **Application type**: `Web application`
   - **Authorized JavaScript origins**:
     ```
     https://yourdomain.com
     http://localhost:3000
     ```
   - **Authorized redirect URIs**:
     ```
     https://yourdomain.com/api/auth/google/callback
     http://localhost:3000/api/auth/google/callback
     ```
   - Click **Create**, then copy the **Client ID** and **Client secret**.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in:
   - Environment variables, or
   - Admin panel → API & Integrations (recommended)

Both providers can be enabled at the same time — `/api-access` shows a button for each.

#### Notes & troubleshooting

- **The redirect URI must match exactly**, character for character, including the path
  and the trailing `/api/auth/google/callback`. A mismatch gives
  `redirect_uri_mismatch` on the Google screen.
- **`http://` is only allowed for `localhost`.** Any other host must be `https://`.
- If you serve the app on a different domain than `APP_URL`, set `APP_URL` (or the
  admin panel's *APP URL* field) so the callback is built against the right host;
  otherwise it is auto-detected from the request.
- Google's `sub` claim is used as the account identifier, namespaced as
  `google:<sub>`. It is stable even if the user later changes their Gmail address,
  which is why the email is never used as a primary key.
- Unverified Google emails are rejected, and a `prompt=select_account` is sent so the
  user always gets to pick which account to use.

## Deployment

### Node (MongoDB)

```bash
cp .env.example .env
# Edit .env with your MongoDB URI
npm install
npm run build
npm start
```

### Cloudflare (D1)

Deploy using the Cloudflare Pages + D1 setup. See admin panel for details.

## Tech Stack

- Next.js 16 (App Router)
- MongoDB / Cloudflare D1 (storage)
- tailwindcss
- framer-motion
- sonner (toasts)
- lucide-react (icons)
