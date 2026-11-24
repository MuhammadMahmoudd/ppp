# Put Dildar online (Cloudflare, ~15 minutes)

Everything runs on **one Cloudflare Worker**: it serves the website and the
API. Your data lives in your own Cloudflare account:

| Piece | Cloudflare product | Free tier |
|---|---|---|
| Website + API | Workers (static assets) | 100k requests/day |
| Database | D1 | 5 GB |
| Encrypted photos, snaps, vault, voice notes | R2 | 10 GB, no egress fees |
| Live chat, typing, games, presence | Durable Objects (SQLite) | included in Free |
| Scheduled messages, streak warnings, snap purge | Cron Triggers | included |

For two people you'll stay well inside the free limits.

---

## One-time setup

You need a computer with **Node.js 20+** (Windows, Mac or Linux) and a free
**Cloudflare account** (dash.cloudflare.com).

```bash
git clone <your repo> && cd ppp/dildar
npm install
npx wrangler login                     # opens the browser, click "Allow"
```

### 1. Database (D1)
```bash
npx wrangler d1 create dildar
```
Copy the printed `database_id` into `wrangler.jsonc`, replacing
`REPLACE_WITH_D1_DATABASE_ID`. Then create the tables:
```bash
npm run db:migrate
```

### 2. File storage (R2)
In the dashboard open **R2 Object Storage** and click **Enable / Purchase R2**.
The free tier is 10 GB, but Cloudflare asks for a payment method once. Then:
```bash
npx wrangler r2 bucket create dildar-media
```

### 3. Deploy
```bash
npm run deploy
```
This builds the website (`dist/`) and uploads the Worker. At the end it prints
your address, e.g. **https://dildar.your-name.workers.dev**. That's your app.

---

## On both iPhones

1. Open the address in **Safari**.
2. Tap **Share → Add to Home Screen**, then **open Dildar from the home-screen
   icon**. It runs full-screen like an app. Do everything from that icon
   from now on: on iPhone a home-screen app keeps its own storage, separate
   from Safari, so a key created in a Safari tab wouldn't be there.
3. Each of you: create an account, then on the key step set a **backup
   passphrase** (write it down offline).
4. You: tick 18+ → **I'll create the code**. Her: tick 18+ → **I have a code**
   → enter it.
5. Compare the **safety code** (Settings › Security) on a call.

The deployment only ever allows **2 accounts** (`MAX_USERS` in
`wrangler.jsonc`), so once you've both signed up nobody else can register.
Only two people can ever pair, and the database enforces that too.

---

## Updating later

After any code change:
```bash
npm run deploy
```
If a change adds a file to `server/migrations/`, run `npm run db:migrate` first.

**Optional, auto-deploy on every push:** Cloudflare dashboard → Workers &
Pages → *dildar* → Settings → Builds → Connect your GitHub repo.
- Root directory: `dildar`
- Build command: `npm ci && npm run build:web`
- Deploy command: `npx wrangler d1 migrations apply dildar --remote && npx wrangler deploy`

**Optional, your own domain:** Workers → *dildar* → Settings → Domains &
Routes → *Add custom domain*.

---

## Good to know

- **What the web version can't do** (browser limits, not bugs):
  - Face ID lock, shake-to-hide, app-switcher blur
  - Screenshot detection and blocking screen recording
  - Push notifications
  - Recording video in the camera (photos, gallery videos and voice notes work)

  The quick-hide calculator (hold the heart logo) still works. These features
  return with the native iPhone build (see `SETUP.md`, "Later").
- **Keys in the browser:** your encryption key is kept in the browser's
  storage for this site. Clearing Safari's website data for it signs you out
  and removes the key. Restore it with your backup passphrase on the key step.
- **Logs:** `npx wrangler tail` shows live server logs.
- **Local testing:** `npm run test:all` runs typechecks, unit tests and the
  backend tests. `npm run test:e2e` builds the site, starts it on Cloudflare's
  local runtime and has two browsers sign up, pair, chat, play and send a snap.
