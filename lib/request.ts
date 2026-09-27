import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./supabase";

// Salted hash of the client IP. The raw IP is never stored.
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const salt = `${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:${process.env.ADMIN_PASSWORD ?? ""}`;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

// Returns true if the action is allowed, and records it. Counts events in a
// sliding window per (bucket, client).
export async function rateLimit(bucket: string, max: number, windowMinutes: number): Promise<boolean> {
  const key = await clientKey();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db()
    .from("rate_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key_hash", key)
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= max) return false;

  await db().from("rate_events").insert({ bucket, key_hash: key });
  // Opportunistic cleanup; nothing needs to be kept longer than a day.
  if (Math.random() < 0.1) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    await db().from("rate_events").delete().lt("created_at", dayAgo);
  }
  return true;
}
