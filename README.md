# Register of Active Excavations

A free, community-kept map of active construction sites around Rochester, NY, so families with small
children can find somewhere to watch the diggers, especially in winter. It's a project of the
Provisional Mud Authority.

Live at **https://map.provisionalmudauthority.com**

- **Map** (`/`): approved sites only. Tap a pin for the description, equipment, best viewing spot,
  safe parking/sidewalk, photo, last-confirmed date, directions, and "Report this pin". Pins not
  confirmed in 60 days fade.
- **Add a site** (`/add`): no account needed. Mark the location by address search, "use my location",
  or tapping the map. One optional photo (sites and machines only, no people). Every submission waits
  in a moderation queue.
- **About** (`/about`)
- **Admin** (`/admin`): one password. Approve or reject the queue, handle reported pins (dismiss,
  refresh the date, remove), add scouted sites directly, and review every live pin.

## Stack

- Next.js 16 (App Router) on Vercel
- Supabase Postgres for pins, reports and rate limiting; Supabase Storage for photos
- Leaflet with free OpenStreetMap tiles; address search uses OpenStreetMap's Nominatim. No paid map APIs.
- Brand tokens (Authority Ink, Cream, Issue Orange, Oswald / EB Garamond / Special Elite) come from the
  PMA Brand Kit Spec in Notion and live as CSS variables at the top of `app/globals.css`.

## Environment variables

| Name | Where to find it | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL | e.g. `https://abcd1234.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` secret | **Server only.** Never commit it, and never give it a `NEXT_PUBLIC_` prefix. |
| `ADMIN_PASSWORD` | You choose | The `/admin` password. Make it long. Changing it signs everyone out. |

These three are all. The browser never talks to the database: every read and write goes through the
server, and row level security is on with no public policies, so Supabase's public keys can't read
anything directly.

## First-time setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). A US East region is closest to Rochester.
   (The free plan allows two active projects per organization.)
2. Apply the schema. Either:
   - **Dashboard:** open SQL Editor, paste the contents of
     `supabase/migrations/20260927000000_init.sql`, and run it; or
   - **CLI:** `npx supabase link --project-ref <your-ref>` then `npx supabase db push`.

   This creates the `pins`, `reports` and `rate_events` tables and a public `pin-photos` storage bucket
   limited to 5 MB JPEG/PNG/WebP files.
3. Copy the Project URL and the `service_role` key for the next steps.

### 2. Local development

Requires Node 20.9 or later.

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev                  # http://localhost:3000
```

`npm run typecheck` and `npm run build` are the checks to run before pushing.

### 3. Vercel

The GitHub repo is already connected to the Vercel project, so every push deploys.

1. Vercel → the project → Settings → Environment Variables. Add `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSWORD` for Production (and Preview, if you want preview
   deploys to work).
2. Redeploy (Deployments → ⋯ → Redeploy) so the variables take effect.
3. Optional page counts: Vercel → the project → Analytics → Enable. It's cookieless and records page
   views only. The app already includes the script; without this step, it does nothing.

### 4. Point `map.provisionalmudauthority.com` at Vercel

1. Vercel → the project → Settings → Domains → **Add** → `map.provisionalmudauthority.com`.
2. Vercel then shows the DNS record to create, normally a **CNAME** with name `map` and a value like
   `cname.vercel-dns.com` (newer projects get a project-specific value such as
   `xxxxxxxx.vercel-dns-017.com`). **Use exactly the value Vercel shows.**
3. Add that record wherever `provisionalmudauthority.com`'s DNS is managed:
   - at your registrar (Namecheap, Squarespace Domains, GoDaddy, Cloudflare, …): DNS settings → add
     record → type `CNAME`, host `map`, value from step 2;
   - if the domain is connected to Shopify and Shopify manages its DNS: Shopify admin → Settings →
     Domains → the domain → **Domain settings → Edit DNS settings** → Add custom record → `CNAME`,
     name `map`, value from step 2.

   This only adds the `map` subdomain and doesn't touch the main store domain. On Cloudflare, set the
   record to **DNS only** (grey cloud).
4. Back in Vercel, the domain turns valid within minutes (DNS can take up to a few hours) and Vercel
   issues the HTTPS certificate on its own.

## Adding the first sites

The first sites are scouted in person, starting with Inner Loop North downtown. Two ways to add them:

- **From your phone, on site:** `/admin` → **Add sites**. It's the same form as the public one, and
  "use my location" drops the pin where you're standing. These go live straight away with today as the
  confirmed date, and the form clears for the next one.
- **In bulk:** `cp seed/pins.example.json seed/pins.json`, fill in real sites, then `npm run seed`. It
  reads `.env.local`. `photo` can be a local file path. Entries that still carry the example text are
  skipped, so nothing unscouted goes live by accident. `seed/pins.json` is git-ignored.

## Moderation

- **Queue:** check that each photo shows no people. **Approve** publishes the pin with the submission
  date as its last-confirmed date. **Reject** deletes the submission and its photo.
- **Reported:** open reports grouped by pin. **Dismiss report** keeps the pin as it is. **Still active:
  refresh date** resets the 60-day clock and clears the reports. **Remove pin** deletes it and its photo.
- **All live pins:** oldest confirmation first, for periodic tidying.

## Privacy and spam

- No accounts, no email, no cookies for visitors. The only cookie is the admin session, and it's
  scoped to `/admin`.
- Photos are re-encoded in the browser before upload. This shrinks phone photos and strips EXIF
  metadata, including GPS. They go straight to Supabase Storage through a short-lived signed URL, so
  they never pass through Vercel's 4.5 MB function body limit.
- Spam protection: a honeypot field, a minimum fill time, and per-IP rate limits (5 submissions and
  10 reports an hour). The rate limiter stores only a salted hash of the IP, never the IP itself, and
  deletes entries after a day.
- Pending photos sit in the public bucket under random, unguessable names until they're approved or
  rejected. Nothing links to them except the admin queue.

## Project layout

```
app/
  page.tsx            map (server-renders approved pins)
  add/page.tsx        submission form
  about/page.tsx
  admin/              password-gated moderation (page, server actions, forms)
  actions.ts          public server actions: submit, report, photo upload URL, address search
  globals.css         brand tokens and all styles
components/           map, pin card, shared site form
lib/                  Supabase client, auth, rate limiting, validation, constants
supabase/migrations/  database schema
scripts/seed.mjs      bulk import of scouted pins
seed/                 example seed file
```
