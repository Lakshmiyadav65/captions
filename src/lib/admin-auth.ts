import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

const COOKIE = "caplio-admin";

function tokenFor(secret: string): string {
  return createHmac("sha256", secret).update("caplio-admin-v1").digest("hex");
}

export function adminConfigured(): boolean {
  return Boolean(config.adminSecret);
}

export async function isAdminAuthed(): Promise<boolean> {
  if (!config.adminSecret) return false;
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) return false;
  const expected = tokenFor(config.adminSecret);
  try {
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function setAdminSession(): Promise<void> {
  if (!config.adminSecret) return;
  const jar = await cookies();
  jar.set(COOKIE, tokenFor(config.adminSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function checkAdminPassword(password: string): boolean {
  if (!config.adminSecret) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(config.adminSecret);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
