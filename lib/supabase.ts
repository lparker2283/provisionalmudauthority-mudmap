import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "./constants";

let client: SupabaseClient | null = null;

// Service-role client. Server only: this key bypasses row level security.
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

export async function deletePhoto(path: string | null) {
  if (!path) return;
  const { error } = await db().storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("Failed to delete photo", path, error.message);
}
