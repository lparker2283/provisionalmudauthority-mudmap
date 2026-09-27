-- Rochester Construction-Watching Map: initial schema.
--
-- All reads and writes go through the Next.js server using the service role
-- key. Row level security is enabled with no anon/authenticated policies, so
-- the public API keys can read nothing directly. The server decides what is
-- public (approved pins only).

create extension if not exists pgcrypto;

-- Pins -----------------------------------------------------------------------

create table public.pins (
  id                uuid primary key default gen_random_uuid(),
  status            text not null default 'pending'
                      check (status in ('pending', 'approved')),
  name              text check (char_length(name) <= 80),
  lat               double precision not null check (lat between -90 and 90),
  lng               double precision not null check (lng between -180 and 180),
  description       text not null check (char_length(description) between 1 and 500),
  equipment         text check (char_length(equipment) <= 300),
  viewing_spot      text check (char_length(viewing_spot) <= 300),
  safe_parking      boolean not null default false,
  parking_note      text check (char_length(parking_note) <= 300),
  photo_path        text check (char_length(photo_path) <= 200),
  last_confirmed_at timestamptz not null default now(),
  approved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index pins_status_idx on public.pins (status);

-- Reports ("report this pin") ------------------------------------------------

create table public.reports (
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid not null references public.pins (id) on delete cascade,
  reason     text not null check (reason in ('finished', 'unsafe', 'inaccurate', 'other')),
  note       text check (char_length(note) <= 500),
  status     text not null default 'open' check (status in ('open', 'dismissed')),
  created_at timestamptz not null default now()
);

create index reports_open_idx on public.reports (pin_id) where status = 'open';

-- Rate limiting --------------------------------------------------------------
-- Stores only a salted hash of the requester's IP, never the IP itself.
-- Rows older than a day are pruned by the app.

create table public.rate_events (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  key_hash   text not null,
  created_at timestamptz not null default now()
);

create index rate_events_lookup_idx on public.rate_events (bucket, key_hash, created_at);

-- Lock down direct API access ------------------------------------------------

alter table public.pins        enable row level security;
alter table public.reports     enable row level security;
alter table public.rate_events enable row level security;

-- Photo storage --------------------------------------------------------------
-- Public-read bucket so approved photos can be shown with plain URLs. Object
-- names are random UUIDs; uploads only happen through short-lived signed
-- upload URLs issued by the server. The bucket itself enforces the 5 MB cap
-- and image-only MIME types.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pin-photos',
  'pin-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
