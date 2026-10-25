# Deploying ScheduleAI (100% free)

This guide takes you from "works on my laptop" to **a live URL on the internet** — no
paid accounts, no credit cards.

| Piece | Service (free tier) | What it does |
|---|---|---|
| Frontend | **Vercel** | The Next.js app you open in the browser |
| Backend | **Render** | The Express API + AI worker |
| Database | **Neon** | Postgres (you already have one) |
| Photos | Render disk | Temporary (see caveats) — swap for Cloudinary later |

---

## ⏱️ Total time: ~20 minutes

---

## Step 0 — Push your code to GitHub (2 min)

Render and Vercel both deploy *from GitHub*, so the code must be there first.

```bash
cd /path/to/ScheduleAI
git add -A && git commit -m "Deploy prep"
git push origin main
```

Check: open `https://github.com/Miccojames/ScheduleAI` — your latest commit is visible.

---

## Step 1 — Your Neon database URL (2 min)

1. Open <https://console.neon.tech> → your project → **Connect**.
2. Copy the **pooled** connection string (the host contains `-pooler`).
   - Pooled = safe for a server that sleeps and wakes up.
3. Keep it handy — you need it in Step 2.

<details>
<summary>Using the direct (non-pooled) URL?</summary>

It works too, but pooled is recommended: a sleeping Render service can hold
idle connections that Postgres eventually drops. If you use the direct URL and
see random connection errors, switch to the pooled one.
</details>

---

## Step 2 — Deploy the backend on Render (6 min)

**Fastest path (blueprint):**

1. Go to <https://render.com> → sign up (GitHub login is fine) → **New → Blueprint**.
2. Connect the repo `Miccojames/ScheduleAI` → Render finds `render.yaml` automatically.
3. Render asks for the values marked `sync: false` — fill them in:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Neon **pooled** URL from Step 1 |
   | `FRONTEND_URL` | leave as `https://placeholder.vercel.app` for now — you fix it in Step 4 |
   | `GEMINI_API_KEY` | your AI Studio key (the one in `backend/.env`) |
   | `VAPID_PUBLIC_KEY` | your VAPID public key (or leave empty → reminders off) |
   | `VAPID_PRIVATE_KEY` | your VAPID private key (or leave empty) |

4. Click **Apply** → Render builds (~2–4 min) → **Live**.

**Manual path** (if you prefer): *New → Web Service → connect repo*, then:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `npm install && npm run build` |
| Start command | `npm run start:prod` |
| Health check path | `/api/health` |
| Instance type | Free |

Then add the same env vars under **Environment**.

> 🎉 Your API is now at `https://scheduleai-api.onrender.com`.
> **Test it:** open `https://scheduleai-api.onrender.com/api/health` → you should see
> `{"success":true,"data":{"status":"ok","database":"up"}}`.
> (First request can take ~30 s while the free service wakes up.)

---

## Step 3 — Deploy the frontend on Vercel (6 min)

1. Go to <https://vercel.com> → sign up (GitHub login) → **Add New → Project**.
2. Import `Miccojames/ScheduleAI`.
3. **Project settings → Root Directory:** `frontend`
4. **Environment Variables → Add:**
   - Name: `API_PROXY_TARGET`
   - Value: `https://scheduleai-zflz.onrender.com` ← your Render URL (or leave
     it unset — that URL is the built-in default)
   - *(no `NEXT_PUBLIC_API_URL` needed — the frontend calls the **same origin**
     and Vercel proxies `/api/*` to the API. That keeps the auth cookie
     first-party, which iOS Safari requires: without it, login on an iPhone
     silently fails and bounces back to the login page.)*
5. **Deploy**.

> ⚠️ `NEXT_PUBLIC_*` variables are **inlined at build time**. If you ever change
> this value later, redeploy (Vercel → Deployments → ⋯ → Redeploy) for it to apply.

> 📦 **Upload limit is 4 MB** (not 8 MB): the Vercel proxy caps request bodies
> at 4.5 MB. Phone photos are typically 1–3 MB, so this is comfortable.

Your app is now at `https://<your-app>.vercel.app`.

---

## Step 4 — Point Render back at Vercel (2 min) ⚠️ don't skip

The backend only accepts browser requests from the exact frontend origin
(CORS + CSRF origin check). Tell Render your Vercel URL:

1. Render → your service → **Environment** → edit `FRONTEND_URL` →
   `https://<your-app>.vercel.app` (no trailing slash) → **Save Changes**.
2. Render redeploys automatically (~2 min).
3. Vercel also gives you preview domains (`<app>-<hash>.vercel.app`) — add the
   main one only, or the preview builds will be blocked by CORS.

---

## Step 4b — Email sending with Gmail SMTP / Resend (5 min) ⚠️ needed before real sign-ups

New accounts can't sign in until they enter the 6-digit verification code we
email them — so with no SMTP configured, sign-ups are created but stuck at
"verify your email". (Password-reset emails use the same settings.)

1. Create a free account at <https://resend.com> → **API Keys** → create one
   (it looks like `re_xxxxxxxx`).
2. **To email real users you must verify a domain you own**: *Domains → Add
   Domain* → paste the 3 DNS records (DKIM/SPF/DMARC) at your registrar.
   - **No domain yet?** Two workable options:
     - **Prove the flow:** leave it unverified — Resend then only delivers to
       *your own* Resend-account address. Enough to test end to end.
     - **Ship anyway:** use **Gmail SMTP** instead (right-hand column below) —
       works for every recipient with just a Google account + an *App
       password* (Google Account → Security → 2-Step Verification → App
       passwords). No domain needed.
3. Render → your service → **Environment** → add → **Save Changes**
   (Render redeploys automatically):

   | Variable | Resend SMTP | Gmail SMTP |
   |---|---|---|
   | `SMTP_HOST` | `smtp.resend.com` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` | `587` |
   | `SMTP_USER` | `resend` | `you@gmail.com` |
   | `SMTP_PASS` | your `re_…` API key | your app password |
   | `SMTP_FROM` | `ScheduleAI <no-reply@yourdomain.com>` | `ScheduleAI <you@gmail.com>` |

4. **Test it:** register a fresh account on the deployed app → the
   verification email arrives → type the 6-digit code → you're signed in
   flow continues at the login screen. Locally nothing is configured by
   default: the code is printed to the server console (and the register
   screen shows it in a "Running locally — dev shortcut" box).

Swapping providers later is just editing these env vars — no code changes.

---

## Step 5 — Verify in production (3 min)

Open your Vercel URL and run through:

1. **Register** a new account (use a fresh email — production DB is your real Neon DB)
   → **check your inbox** and enter the 6-digit code → sign in.
2. **Upload Schedule** → scan a photo → the review page shows your real classes.
3. **Save Schedule** → check the *Schedules* page.
4. **Export**: try the `.ics` download and the *Google Calendar* button.
5. **Reminders**: Settings → *Notifications* → turn on → *Send a test notification*.

### Or run the automated contract test against production

The same suite used in development works against the deployed API:

```bash
cd backend
# Against production the API never exposes verification codes, so hand the
# suite your direct (non-pooler) Neon URL — it stamps its own test rows:
SMOKE_DB_URL="postgresql://…" npm run smoke -- https://scheduleai-api.onrender.com
```

It creates throwaway `smoke-*@example.com` accounts (delete them afterwards from
the admin panel / database if you care). Expect `39 passed, 0 failed` locally
(two code-reuse/wipe checks are skipped in production, where the code never
leaves the API). Note: the first request may take ~30 s while the free service
wakes up.

---

## Free-tier caveats (and their workarounds)
### 😴 The backend sleeps after ~15 minutes of inactivity
Free Render instances spin down when unused. The **first request after a nap
takes ~30 seconds** (the browser may show a "loading" state — that's it waking up).

**Reminders only fire while the server is awake.** To keep it awake (and the
reminder sweep running), set up a free pinger:

1. Create a free account at <https://cron-job.org>.
2. New cron job → `https://scheduleai-api.onrender.com/api/health` → every 10 minutes.
3. Done — the API stays warm and the 60-second reminder sweep keeps running.

### 🗑️ Uploaded photos are deleted on redeploy
Images are stored on the container disk, which Render wipes on every deploy and
spin-down. Your *schedules and entries* are safe (they're in Neon) — only the
scanned **photos** are temporary. For a long-lived install, add Cloudinary
(free tier) and store image URLs in the DB instead of files on disk.

### 🤖 Gemini free-tier limits
20 scans/day, and it gets congested at peak times. Background processing
(Phase 1) means a slow scan never breaks the UI; it may still fall back to
clearly-labelled demo data when Gemini is unavailable.

The **AI assistant** shares the same key but uses its own model
(`GEMINI_CHAT_MODEL`, default `gemini-3.1-flash-lite` — ~1.5s/call; the
scanner's `gemini-3.8-flash` takes 33s+ and often times out on chat turns).
Each message is capped at 3 model calls, and chat has its own rate limit
(20/15 min per IP). When the free tier is exhausted, the assistant answers
with a friendly "try again in ~15 minutes" message instead of failing hard.

### 🗄️ Neon free tier
Your database pauses after 5 minutes of inactivity on the free plan and resumes
on the next query (a few seconds' delay the first time). Fine for a class
project; upgrade if you need it always hot.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `CORS error` in the browser console | `FRONTEND_URL` doesn't match your Vercel URL | Edit it in Render (Step 4) — no trailing slash |
| Signed out immediately / 401s | Cookie blocked | Make sure you're on `https://` (not the preview domain) and `FRONTEND_URL` matches exactly |
| `Database unreachable` on /api/health | Wrong `DATABASE_URL` | Use the **pooled** Neon URL; check the password |
| Migrations not applied | `start` used instead of `start:prod` | Start command must be `npm run start:prod` (it runs `prisma migrate deploy`) |
| Images 404 after a while | Ephemeral disk | Expected — see caveats; images re-upload fine |
| Reminders never arrive | Server asleep, or VAPID keys missing | Add the cron pinger; check VAPID keys in Render |
| Vercel build fails on `NEXT_PUBLIC_API_URL` | Missing at build time | Add the env var, then redeploy |
| "AI provider returned malformed output" | Truncated model output | Already handled: retried, salvaged, then honest error |

---

## Local development still works the same

```bash
# backend (port 5000)
cd backend && npm run dev

# frontend (port 3000)
cd frontend && npm run dev
```

`backend/.env` is for local use only. Production secrets live in Render/Vercel
dashboards (or `render.yaml`), never in git.

---

## Updating later

```bash
git add -A && git commit -m "your change" && git push origin main
```

- **Render** redeploys automatically on push.
- **Vercel** redeploys automatically on push (and rebuilds with the current env vars).
