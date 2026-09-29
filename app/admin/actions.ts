"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/auth";
import { PHOTO_BUCKET } from "@/lib/constants";
import { sendTestNotification } from "@/lib/notify";
import { rateLimit } from "@/lib/request";
import { db, deletePhoto } from "@/lib/supabase";
import { isValidPhotoPath, parsePinInput } from "@/lib/validate";

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/");
}

async function photoPathOf(id: string): Promise<string | null> {
  const { data } = await db().from("pins").select("photo_path").eq("id", id).maybeSingle();
  return (data?.photo_path as string | null) ?? null;
}

// --- Session -------------------------------------------------------------------

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  if (!(await rateLimit("admin-login", 8, 15))) return "Too many attempts. Wait a few minutes.";
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) return "That password is not on file.";
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin");
}

// --- Moderation queue ------------------------------------------------------------

export async function approvePin(id: string) {
  await requireAdmin();
  // last_confirmed_at stays at submission time: that is when someone saw it.
  await db().from("pins").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
  refresh();
}

// Rejecting deletes the submission and its photo outright.
export async function rejectPin(id: string) {
  await requireAdmin();
  await deletePhoto(await photoPathOf(id));
  await db().from("pins").delete().eq("id", id);
  refresh();
}

// --- Reports -------------------------------------------------------------------

export async function dismissReports(pinId: string) {
  await requireAdmin();
  await db().from("reports").update({ status: "dismissed" }).eq("pin_id", pinId).eq("status", "open");
  refresh();
}

export async function confirmPin(pinId: string) {
  await requireAdmin();
  await db().from("pins").update({ last_confirmed_at: new Date().toISOString() }).eq("id", pinId);
  await db().from("reports").update({ status: "dismissed" }).eq("pin_id", pinId).eq("status", "open");
  refresh();
}

export async function removePin(pinId: string) {
  await requireAdmin();
  await deletePhoto(await photoPathOf(pinId));
  await db().from("pins").delete().eq("id", pinId); // reports cascade
  refresh();
}

// --- Admin bulk add (seeding) ------------------------------------------------------

export async function adminRequestUpload(
  contentType: string,
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (contentType !== "image/jpeg") return { ok: false, error: "Unexpected photo type." };
  const path = `pending/${randomUUID()}.jpg`;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Upload URL failed." };
  return { ok: true, path, url: data.signedUrl };
}

export async function adminAddPin(raw: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = parsePinInput(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const photo_path = isValidPhotoPath(raw.photo_path) ? raw.photo_path : null;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("pins")
    .insert({ ...parsed.value, photo_path, status: "approved", approved_at: now, last_confirmed_at: now });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// --- Notifications -------------------------------------------------------------

export async function testNotification(_prev: string | null): Promise<string> {
  await requireAdmin();
  return sendTestNotification();
}
