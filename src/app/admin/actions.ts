"use server";

import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  clearAdminSession,
  isAdminAuthed,
  setAdminSession,
} from "@/lib/admin-auth";

export async function adminLoginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!checkAdminPassword(password)) {
    redirect("/admin?error=1");
  }
  await setAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await clearAdminSession();
  redirect("/admin");
}

export async function adminAdjustCreditsAction(formData: FormData) {
  if (!(await isAdminAuthed())) {
    redirect("/admin");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const minutes = Number(formData.get("minutes"));
  const description = String(formData.get("description") ?? "").trim();
  const { prisma } = await import("@/lib/db");
  const { adjustMinutes } = await import("@/lib/credits");
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user || !Number.isFinite(minutes) || minutes === 0) {
    redirect("/admin?error=credits");
  }
  await adjustMinutes({
    userId: user.id,
    minutes,
    description: description || "Admin adjustment",
  });
  redirect("/admin");
}
