# ScheduleAI — AI Schedule Scanner & Planner

Upload a photo of your class schedule → AI extracts the classes → you review & edit → it lands on an interactive weekly calendar. Built for real students: fully usable without AI (manual entry), mobile-friendly, and deployment-ready.

## Features

- 📸 **AI schedule scanner** — drag-and-drop / camera upload (JPG, PNG, WebP), processed by Google Gemini vision (free tier) with a built-in demo provider when no key is set
- 🤖 **AI schedule assistant** — floating chat bubble on every signed-in page; asks about your week **or creates/edits/deletes events by natural language** (Gemini function calling), full chat history, demo mode when no key is set
- ✍️ **Review before save** — every detected field is editable; the AI never writes to the database directly
- ⚠️ **Conflict detection** — overlapping classes are highlighted, never auto-deleted
- 📅 **Weekly calendar** — desktop grid with overlap-aware blocks; mobile day-view with day selector
- 📊 **Dashboard** — today's classes, next class with countdown, in-app reminders, upcoming week
- 🔐 **Secure auth** — bcrypt password hashing, JWT in HTTP-only cookie, per-user data scoping (users can never see each other's schedules)
- 🗂 **Multiple schedules** — "1st Semester", "2nd Semester", "Summer" — create, rename, switch, delete
- 🔍 **Search / filter / sort** — by subject, instructor, room, day, time
- 📱 **Mobile-first** — bottom navigation, touch-friendly, no horizontal scrolling

## Tech stack

| | |
|---|---|
| **Frontend** | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · TanStack Query · React Hook Form · Zod · Zustand · Lucide |
| **Backend** | Node.js · Express 5 · TypeScript · Zod · multer · JWT (http-only cookie) |
| **Database** | PostgreSQL · Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| **AI** | Google Gemini (`gemini-3.8-flash`) behind a provider interface · mock provider for keyless dev |
| **Deploy** | Frontend → Vercel · Backend → Render · Managed Postgres (Neon, Render PostgreSQL, Supabase…) |

## Project structure

```
frontend/            Next.js app
  app/               routes (auth + guarded app pages)
  components/        layout · schedule · upload · dashboard · common · ui (shadcn)
  hooks/ services/ lib/ stores/ schemas/ types/
backend/             Express API
  prisma/            schema + migrations
  src/
    controllers/ routes/ services/ middleware/ validators/ utils/ config/
    services/ocr/    provider interface + gemini + mock
  scripts/           embedded-postgres dev DB · test-image generator · smoke suite
```

## Quick start (local dev)

Prerequisites: Node.js ≥ 20, npm ≥ 10. No system Postgres needed — the backend ships with an **embedded Postgres** for development.

```bash
# 1. Backend
cd backend
npm install
npm approve-scripts sharp @embedded-postgres/linux-x64 @prisma/engines esbuild prisma   # npm 11 script gate
cp .env.example .env
npm run db:start                 # embedded Postgres on :5433
npx prisma migrate dev --name init
npm run dev                      # API on :5000

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                      # web app on :3000
```

Open http://localhost:3000, register, and try the **Upload Schedule** flow — with no AI key configured you'll see a clearly-labeled *demo extraction*; the full pipeline (upload → review → edit → save → calendar) works the same either way.

### Enabling real AI (Gemini, free)

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. `backend/.env` → `GEMINI_API_KEY=your_key` (optionally `GEMINI_MODEL=gemini-3.8-flash`)
3. Restart the backend — uploads are now analyzed by Gemini

## Environment variables

**Backend** (`backend/.env`):

| Var | Purpose |
|---|---|
| `PORT` | API port (Render sets this automatically) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Token signing secret — use a long random string in production |
| `FRONTEND_URL` | Exact frontend origin for CORS + CSRF origin check (e.g. `https://your-app.vercel.app`) |
| `GEMINI_API_KEY` | Optional — leave empty to use the demo provider |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.8-flash` (schedule scanner) |
| `GEMINI_CHAT_MODEL` | Optional, defaults to `gemini-3.1-flash-lite` (assistant chat — ~1.5s/call vs 33s+ on 3.8-flash) |
| `UPLOAD_DIR` | Where uploaded images are stored (default `./uploads`) |

**Frontend** (`frontend/.env.local`):

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `https://your-api.onrender.com`) |

`.env` files are gitignored — never commit real keys.

## API overview

All responses use the envelope `{ success, data, message? }` / `{ success, message, errors? }`.

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `login` · `logout` · `GET/PUT /api/auth/me` |
| Schedules | `GET/POST /api/schedules` · `GET/PUT/DELETE /api/schedules/:id` |
| Entries | `GET/POST /api/schedules/:id/entries` · `PUT/DELETE .../entries/:entryId` · `POST .../entries/bulk` |
| Upload | `POST /api/schedule-upload` · `GET .../:id/image` · `POST .../:id/process` |
| Assistant | `POST /api/assistant/chat` · `GET/DELETE /api/assistant/messages` |

AI flow: upload image → `process` returns **detected entries only** → user reviews/edits on the review screen → confirmed entries are validated and saved via the bulk endpoint. Authorization is enforced on every query (other users' resources return `404`).

Assistant flow: one `chat` message runs a **bounded tool loop** (max 3 model calls) over `list_schedules` / `list_events` / `create_schedule` / `create_event` / `update_event` / `delete_event` — every tool executes against the **session** user, so the model can never touch another account. Both messages of a turn are persisted to `ChatMessage` history; `changedSchedule: true` in the reply tells the frontend to refresh the calendar. Rate-limited separately (`assistantLimiter`, 20/15 min) so a chatty assistant can never starve sign-in.

## Verification

```bash
cd backend && npm run smoke    # 25-step end-to-end API suite (needs db:start + dev server)
```

Covers: register/login/logout, schedule + entry CRUD, multi-day bulk save with duplicate skipping, conflict detection, cross-user access denial (404), upload validation (type/size/magic bytes), mock AI processing, and image access control.

## Deployment

**Backend → Render** (Web Service):
- Build command: `npm install && npm run build`
- Start command: `npm run start:prod` (runs `prisma migrate deploy` then starts `dist/server.js`)
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL=https://your-app.vercel.app`, `GEMINI_API_KEY`

**Frontend → Vercel**:
- Root directory: `frontend/`
- Env var: `NEXT_PUBLIC_API_URL=https://your-api.onrender.com`

> Note: Render's disk is ephemeral — uploaded images may be cleared on redeploy, but saved schedules live in Postgres and are unaffected. Swap `UPLOAD_DIR` storage for S3/Cloudinary if you need durable image storage later.

## Notes for the thesis defense

- Passwords are hashed with bcrypt; JWTs live in HTTP-only cookies (JS never reads them)
- The AI provider is pluggable (`ScheduleImageAnalyzer` interface) — Gemini, OpenAI, or Tesseract can be swapped without touching the rest of the app
- AI output is treated as untrusted: parsed, validated with Zod, flagged for uncertain fields, and **never saved without user confirmation**
- Conflicts are surfaced, never auto-resolved — the student decides
