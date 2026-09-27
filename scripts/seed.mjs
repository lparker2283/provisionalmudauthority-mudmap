// Bulk-add scouted pins before launch.
//
//   cp seed/pins.example.json seed/pins.json   # then edit with real sites
//   npm run seed                               # or: npm run seed -- path/to/file.json
//
// Pins are inserted as approved, with today as their last-confirmed date.
// A pin's optional "photo" is a local file path (JPEG/PNG/WebP, max 5 MB);
// it's uploaded to storage. Strip location metadata from photos first, and
// remember: sites and machines only, no people.
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or
// from .env.local.

import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  process.exit(1);
}

const file = process.argv[2] ?? "seed/pins.json";
if (!existsSync(file)) {
  console.error(`No ${file}. Copy seed/pins.example.json to seed/pins.json and fill it in.`);
  process.exit(1);
}

const AREA = { south: 42.8, north: 43.4, west: -78.2, east: -77.1 };
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pins = JSON.parse(await readFile(file, "utf8"));
const now = new Date().toISOString();
let added = 0;

for (const [i, p] of pins.entries()) {
  const label = p.name ?? `#${i + 1}`;
  if (/EXAMPLE, NOT YET SCOUTED/.test(p.description ?? "")) {
    console.warn(`Skipping ${label}: still the example text.`);
    continue;
  }
  if (!(p.lat >= AREA.south && p.lat <= AREA.north && p.lng >= AREA.west && p.lng <= AREA.east)) {
    console.warn(`Skipping ${label}: outside greater Rochester.`);
    continue;
  }
  if (!p.description) {
    console.warn(`Skipping ${label}: needs a description.`);
    continue;
  }

  let photo_path = null;
  if (p.photo) {
    const ext = path.extname(p.photo).toLowerCase();
    const type = TYPES[ext];
    if (!type) throw new Error(`${label}: photo must be JPEG, PNG or WebP`);
    if ((await stat(p.photo)).size > 5 * 1024 * 1024) throw new Error(`${label}: photo is over 5 MB`);
    photo_path = `seed/${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
    const { error } = await supabase.storage
      .from("pin-photos")
      .upload(photo_path, await readFile(p.photo), { contentType: type });
    if (error) throw new Error(`${label}: photo upload failed: ${error.message}`);
  }

  const { error } = await supabase.from("pins").insert({
    name: p.name ?? null,
    lat: p.lat,
    lng: p.lng,
    description: p.description,
    equipment: p.equipment ?? null,
    viewing_spot: p.viewing_spot ?? null,
    safe_parking: !!p.safe_parking,
    parking_note: p.parking_note ?? null,
    photo_path,
    status: "approved",
    approved_at: now,
    last_confirmed_at: p.last_confirmed_at ?? now,
  });
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`Added ${label}`);
  added++;
}

console.log(`Done. ${added} of ${pins.length} pins added.`);
