# CLAUDE.md — Jetski Arcachon CRM

Always read PRD.md before implementing a new feature.

## Stack
- Next.js 14 App Router, TypeScript
- Supabase (PostgreSQL + Auth + Realtime)
- shadcn/ui + Tailwind CSS
- FullCalendar v6 (calendar view)
- Recharts (analytics)
- Resend (emails)

## Structure
- `app/(auth)/` — login only, no auth required
- `app/(crm)/` — all CRM routes, protected by layout + middleware
- `app/api/` — REST endpoints (reservations, availability, notifications)
- `components/ui/` — shadcn primitives (do not modify unless upgrading)
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server Supabase client (Server Components, API routes)
- `supabase/migrations/` — versioned SQL migrations

## Conventions
- French UI — all user-facing text in French
- Jet ski colors: GTI SE 130 = #3B82F6 (blue), GTX 230 = #10B981 (green), RXT-X 300 = #EF4444 (red)
- Status flow: pending → confirmed → in_progress → completed / cancelled / no_show
- Availability sync is handled by a DB trigger (sync_availability_on_reservation)
- `revalidate = 0` on all CRM pages (always fresh data)

## Env vars required
See `.env.local.example`

## Running locally
```bash
cd crm
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, RESEND_API_KEY
npm run dev
```

## Supabase setup
1. Create project at https://app.supabase.com
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor
3. Create a staff user via Authentication > Users > Invite user
