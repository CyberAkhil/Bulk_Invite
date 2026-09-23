# WhatsApp Bulk Invite — Multi-user

Upload an Excel sheet of contacts (name + phone) and send a WhatsApp group invite link to everyone on the list, with rate-limited sending. Each signed-up user connects their own WhatsApp account and manages their own contact list independently.

Signup is **invite-code only** — there's no open public signup. This is intentional: an open tool that lets anyone bulk-send WhatsApp messages is a spam/abuse magnet and risks WhatsApp bans for whoever uses it. See "Known risk" below before opening this to more people.

## Setup

```bash
npm install
```

If the install warns that Puppeteer's postinstall script was blocked, run this once to fetch Chrome manually:

```bash
npx puppeteer browsers install chrome
```

Then start the server:

```bash
npm start
```

## Creating accounts (invite-only)

Two ways to generate an invite code:

**Via the Admin panel (recommended):** log in as the admin account (`nikhilgumasta1@gmail.com` by default — override with the `ADMIN_EMAIL` env var), an **Admin** link appears in the nav automatically. Click **Generate invite code** and share the code shown.

**Via the CLI** (useful before any account exists yet, or for scripting):
```bash
node scripts/create-invite.js
```
This prints a one-time invite code. Each code works once.

## Forgot password

The **Forgot password?** link on the login page emails a reset link, valid for 1 hour. Email sending needs to be configured via environment variables — pick one:

**Gmail:**
```
GMAIL_USER=youraddress@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
```
`GMAIL_APP_PASSWORD` is a Gmail **App Password** (not your normal Gmail password) — generate one from your Google Account → Security → 2-Step Verification → App passwords (requires 2FA enabled on the account).

**Any other SMTP provider:**
```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=you@yourdomain.com
SMTP_PASS=yourpassword
```

**If neither is set:** no email is sent, but the reset link is printed to the server console (`[auth] Password reset link for ...`) — fine for local testing, not for anyone but you to use.

Also set `APP_BASE_URL` (e.g. `https://your-app.up.railway.app`) once deployed, so reset links point at the right domain instead of `localhost`.

## First-time use (per user)

After logging in, it lands on **Connect**. Four pages, in order:

1. **Connect** — scan the QR code from WhatsApp → Linked Devices. This is *your own* WhatsApp account being connected — each user's session is isolated (stored under `./sessions`, keyed by their account).
2. **Upload** — an `.xlsx`/`.csv` file with a name column and a phone/mobile/number column.
3. **Send** — paste your WhatsApp group invite link, customize the message (`{name}` and `{link}` get substituted), hit **Start sending**. Messages go out one at a time with a 4–6 second randomized delay.
4. **Status** — live sent/failed/pending table with error reasons.

A light/dark toggle and Logout sit in the top nav on every page.

## Architecture notes

- **Auth:** email/password with `bcryptjs`, session cookies via `express-session`. Users and invite codes are stored in `data/users.json` and `data/invites.json` — flat JSON files, not a real database. Fine for a small pilot; move to a real DB (Postgres/MongoDB) before this has more than a handful of users.
- **Per-user WhatsApp sessions:** each user gets their own `whatsapp-web.js` client, isolated via `LocalAuth`'s `clientId`. **This is the biggest resource cost in this architecture** — every connected user is a full Chromium process running on your server. 10 active users ≈ 10 Chromium instances. Plan server capacity accordingly (this is not free to scale).
- **Contacts/send state** still lives in memory per user session — restarting the server clears everyone's uploaded contacts and send progress, though their login and WhatsApp connection (session files) persist.

## Deploying to Railway

This repo includes a `Dockerfile` and `railway.json` — Railway will auto-detect and build from them.

1. **Push this project to a GitHub repo** (Railway deploys from a repo, not a local zip).
2. On [railway.app](https://railway.app), **New Project → Deploy from GitHub repo** → pick your repo.
3. Railway builds the Docker image automatically (uses the included `Dockerfile`).
4. **Add a volume** (Settings → Volumes → New Volume): mount path `/app/storage`. This is where every user's WhatsApp session *and* the `users.json`/`invites.json` account data live — without this volume, everything resets on every redeploy or restart.
5. **Set environment variables** (Settings → Variables):
   - `SESSION_SECRET` — any long random string (this signs login sessions; don't skip it)
   - `ADMIN_EMAIL` — optional, defaults to `nikhilgumasta1@gmail.com`
   - `APP_BASE_URL` — your Railway URL once generated (e.g. `https://your-app.up.railway.app`), so password reset links point at the right place
   - `GMAIL_USER` + `GMAIL_APP_PASSWORD` (or the `SMTP_*` variables) — optional, needed for forgot-password emails to actually send. Without these, reset links just get logged to Railway's deploy logs instead.
6. Deploy. Railway gives you a public URL automatically (Settings → Networking → Generate Domain).
7. Once it's live, generate an invite code **from your local machine** first (`node scripts/create-invite.js` writes to local `storage/data/invites.json`, not the deployed one) — instead, run it on the deployed instance via Railway's shell:
   ```bash
   railway run node scripts/create-invite.js
   ```
   (requires the [Railway CLI](https://docs.railway.app/guides/cli)). This runs against the live deployment's storage, not your local files.

### A note on scale
Every logged-in user who connects WhatsApp spins up a full Chromium process on the server. Railway's free/starter tiers have limited RAM — a handful of concurrent connected users is realistic; dozens will need a bigger plan. Keep the invite-only gate until you've tested what your plan can actually handle.

## Known risk

- Sending too fast, or scaling past a small pilot on this unofficial library, risks WhatsApp banning the connected number. Don't reduce the delay in `routes/whatsapp.js` without understanding that tradeoff.
- **Invite-only is a safety choice, not just a formality.** If you open signup further, you have no control over what lists people upload or who they message — that's exactly the profile WhatsApp bans for and could get the tool itself shut down. Before any wider/public launch, migrate to the official WhatsApp Business API, which is built for this and doesn't carry ban risk the same way.
- Set `SESSION_SECRET` as an environment variable before deploying anywhere real — the default in the code is a placeholder.

## Change password before going live

Set a real session secret:
```bash
SESSION_SECRET="something-long-and-random" npm start
```
