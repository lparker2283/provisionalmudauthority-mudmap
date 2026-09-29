import "server-only";
import { headers } from "next/headers";
import { db } from "./supabase";

// Phone push notifications to the moderator via ntfy (https://ntfy.sh).
//
// Set NTFY_TOPIC to a long, unguessable topic name and subscribe to it in
// the ntfy app. Unset, notifications are simply off. Messages carry counts
// only, never submission text, because ntfy topics are readable by anyone
// who knows the name.

const THROTTLE_MINUTES = 10;

type Counts = { sites: number; reports: number };

async function queueCounts(): Promise<Counts> {
  const [pins, reports] = await Promise.all([
    db().from("pins").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db().from("reports").select("pin_id").eq("status", "open"),
  ]);
  const reportedPins = new Set((reports.data ?? []).map((r: { pin_id: string }) => r.pin_id));
  return { sites: pins.count ?? 0, reports: reportedPins.size };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function describeQueue({ sites, reports }: Counts): string {
  const parts = [
    sites > 0 && `${plural(sites, "site")} to review`,
    reports > 0 && `${plural(reports, "reported pin")} to check`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" and ")}.` : "The queue is empty.";
}

async function adminUrl(): Promise<string> {
  const host = (await headers()).get("host");
  return host ? `https://${host}/admin` : "https://map.provisionalmudauthority.com/admin";
}

async function send(title: string, message: string, click: string): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  const server = (process.env.NTFY_SERVER ?? "https://ntfy.sh").replace(/\/$/, "");
  const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
    method: "POST",
    body: message,
    headers: {
      Title: title,
      Tags: "construction",
      Click: click,
      // Optional: a free ntfy account's access token, for higher rate limits.
      ...(process.env.NTFY_TOKEN ? { Authorization: `Bearer ${process.env.NTFY_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
  return true;
}

// Called after a submission or report. Sends at most one push per
// THROTTLE_MINUTES across the whole site, so a burst of activity (or spam)
// means one buzz, not dozens. Never throws: a failed push must not affect
// the person who just submitted.
export async function notifyQueueChanged(): Promise<void> {
  if (!process.env.NTFY_TOPIC) return;
  try {
    const since = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString();
    const { count } = await db()
      .from("rate_events")
      .select("id", { count: "exact", head: true })
      .eq("bucket", "notify")
      .gte("created_at", since);
    if ((count ?? 0) > 0) return;
    await db().from("rate_events").insert({ bucket: "notify", key_hash: "site" });

    const counts = await queueCounts();
    if (counts.sites === 0 && counts.reports === 0) return;
    await send("Register of Active Excavations", describeQueue(counts), await adminUrl());
  } catch (e) {
    console.error("notifyQueueChanged", e);
  }
}

// For the admin "Send test notification" button. Unthrottled; returns a
// human-readable result.
export async function sendTestNotification(): Promise<string> {
  if (!process.env.NTFY_TOPIC) return "Notifications are off: NTFY_TOPIC isn't set in Vercel.";
  try {
    const counts = await queueCounts();
    await send("Test from the Register", `Notifications are working. ${describeQueue(counts)}`, await adminUrl());
    return "Test sent. It should arrive on your phone within a few seconds.";
  } catch (e) {
    console.error("sendTestNotification", e);
    return `The test didn't send (${(e as Error).message}). Check NTFY_TOPIC in Vercel.`;
  }
}
