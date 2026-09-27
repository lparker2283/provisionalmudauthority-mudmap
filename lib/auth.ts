import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "pma_admin";

function expectedToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  // Changing ADMIN_PASSWORD invalidates every existing session.
  return createHmac("sha256", password).update("pma-admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passwordMatches(candidate: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const h = (s: string) => createHmac("sha256", "pma-compare").update(s).digest("hex");
  return safeEqual(h(candidate), h(password));
}

export async function isAdmin(): Promise<boolean> {
  const token = expectedToken();
  if (!token) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!value && safeEqual(value, token);
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function startSession() {
  const token = expectedToken();
  if (!token) throw new Error("ADMIN_PASSWORD is not set");
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}
