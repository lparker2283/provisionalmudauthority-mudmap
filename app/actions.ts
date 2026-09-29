"use server";

import { randomUUID } from "node:crypto";
import { LIMITS, PHOTO_BUCKET, REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { rateLimit } from "@/lib/request";
import { db } from "@/lib/supabase";
import { isValidPhotoPath, parsePinInput } from "@/lib/validate";

type Result = { ok: true } | { ok: false; error: string };

const SLOW_DOWN = "The Authority has received several filings from this location recently. Please try again in a little while.";

// --- Photo upload ------------------------------------------------------------
// Photos go straight from the browser to Supabase Storage using a short-lived
// signed URL, so they never pass through (and never hit the body-size limit
// of) the Vercel function. The bucket enforces the 5 MB cap and MIME types.

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function requestPhotoUpload(
  contentType: string,
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  const ext = EXT[contentType];
  if (!ext) return { ok: false, error: "Photos must be JPEG, PNG or WebP." };
  if (!(await rateLimit("upload", 10, 60))) return { ok: false, error: SLOW_DOWN };

  const path = `pending/${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Could not prepare the photo upload. Try again, or submit without a photo." };
  return { ok: true, path, url: data.signedUrl };
}

// --- Submit a pin --------------------------------------------------------------

export async function submitPin(raw: Record<string, unknown>): Promise<Result> {
  // Honeypot: a field real people never see. Pretend it worked.
  if (typeof raw.website === "string" && raw.website.trim() !== "") return { ok: true };
  // Filled in faster than a person could read the form.
  const startedAt = Number(raw.started_at);
  if (Number.isFinite(startedAt) && Date.now() - startedAt < 3000) return { ok: true };

  const parsed = parsePinInput(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  let photo_path: string | null = null;
  if (raw.photo_path != null && raw.photo_path !== "") {
    if (!isValidPhotoPath(raw.photo_path)) return { ok: false, error: "The photo upload did not complete. Please try again." };
    photo_path = raw.photo_path;
  }

  if (!(await rateLimit("submit", 5, 60))) return { ok: false, error: SLOW_DOWN };

  const { error } = await db()
    .from("pins")
    .insert({ ...parsed.value, photo_path, status: "pending" });
  if (error) {
    console.error("submitPin", error.message);
    return { ok: false, error: "Something went wrong filing that. Please try again." };
  }
  return { ok: true };
}

// --- Report a pin --------------------------------------------------------------

export async function reportPin(pinId: string, reason: string, note: string): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/.test(pinId)) return { ok: false, error: "Unknown site." };
  if (!(reason in REPORT_REASONS)) return { ok: false, error: "Please choose a reason." };
  if (!(await rateLimit("report", 10, 60))) return { ok: false, error: SLOW_DOWN };

  const { error } = await db()
    .from("reports")
    .insert({
      pin_id: pinId,
      reason: reason as ReportReason,
      note: note.trim().slice(0, LIMITS.reportNote) || null,
    });
  if (error) {
    console.error("reportPin", error.message);
    return { ok: false, error: "Something went wrong filing that report. Please try again." };
  }
  return { ok: true };
}
