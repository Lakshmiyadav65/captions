"use server";

import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  clearAdminSession,
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
