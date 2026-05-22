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

## Third-party SDK clients — lazy initialization
Never instantiate SDK clients at module level (e.g. `export const resend = new Resend(...)`).
Next.js evaluates module-level exports during `next build`, when env vars are not available → build crash.
Use a lazy singleton instead:
```ts
let _client: Client | null = null
export function getClient() {
  if (!_client) _client = new Client(process.env.API_KEY!)
  return _client
}
```
See `lib/resend.ts` for the reference implementation.

## TypeScript gotchas
- `DateClickArg` is exported from `@fullcalendar/interaction`, NOT `@fullcalendar/core`
- Supabase SSR `setAll` cookie handler must be explicitly typed using `CookieOptions` from `@supabase/ssr`
- Cast dynamic DB values to concrete types (e.g. `ReservationStatus`) rather than `as any` — strict mode rejects `any` indexing into typed Records

## Animations / UI polish
- Page transitions: `PageWrapper` component (`components/providers/page-wrapper.tsx`) uses `key={pathname}` + `animate-in fade-in-0 slide-in-from-bottom-2` (requires `tailwindcss-animate` plugin)
- Reusable hover utilities defined in `app/globals.css` under `@layer components`: `.card-interactive`, `.kpi-card`, `.row-hover`
- Button press feedback: `active:scale-[0.97] transition-all` in `components/ui/button.tsx`

## Deployment (Vercel)
- Set all env vars in Vercel → Settings → Environment Variables before deploying
- Required at runtime: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_FROM_EMAIL` and `RESEND_STAFF_EMAIL` have fallback defaults in `lib/resend.ts` but should be set explicitly

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
