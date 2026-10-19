# ScheduleAI — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (Radix) frontend for
**ScheduleAI — AI Schedule Scanner & Planner**.

## Getting started

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev                    # http://localhost:3000
```

Production build:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm start
```

## Environment

| Variable              | Purpose                          | Default                 |
| --------------------- | -------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Base URL of the ScheduleAI API   | `http://localhost:5000` |

Every request goes through `services/api.ts`, which sends the httpOnly
`scheduleai_token` cookie (`credentials: "include"`), unwraps the
`{ success, data, message }` envelope, and redirects to `/login` on a 401.

## Structure

```
app/
  (auth)/login, register      centered card screens
  (app)/dashboard             stats, next class, today, upcoming
  (app)/schedule              weekly calendar (desktop) / day view (mobile)
  (app)/schedules             schedule list: switch, rename, delete
  (app)/add-class             class form
  (app)/settings              profile, reminder lead time, sign out
  (app)/upload                dropzone → upload → process
  (app)/upload/review         review detected classes, live conflict preview, save
components/
  layout/                     AppShell, Sidebar, MobileNav, Header, AuthGuard
  schedule/                   calendar, blocks, class form + dialogs, review table
  upload/                     dropzone, processing steps
  dashboard/                  stats, next class, today, upcoming, reminder
  common/                     EmptyState, ErrorState, LoadingState, ConfirmDialog
  ui/                         shadcn/ui primitives
hooks/                        react-query hooks + useCountdown
lib/                          time, conflicts, calendar layout, navigation
services/                     api.ts, auth.api.ts, schedule.api.ts, upload.api.ts
stores/                       zustand: active schedule, review result, reminders
types/                        shared API contract types
```

## Design tokens

Defined in `app/globals.css` (Tailwind v4 CSS-first `@theme`):

- App background `#F9FAFB`, cards white, borders `#E5E7EB`
- Single accent indigo `#6366F1` (matches the backend class-block palette)
- Radii: `--radius: 0.625rem` → cards are `rounded-2xl`
- Inter via `next/font`, `prefers-reduced-motion` respected

## Notes for a thesis defense

- `lib/conflicts.ts` is a pure client-side mirror of the backend conflict rule and is only
  used for live previews; the server stays authoritative on save.
- Class colours come from the backend palette:
  `#6366F1 #8B5CF6 #EC4899 #F59E0B #10B981 #06B6D4 #3B82F6 #EF4444`.
- Calendar blocks are positioned with CSS percentages inside a flex column
  (`lib/calendar.ts`), so the week grid stays fluid at any width.