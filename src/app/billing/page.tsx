import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { config } from "@/lib/config";
import { SettingsClient } from "@/components/console/SettingsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — Telugu Captions",
};

export default async function BillingPage() {
  if (config.authEnabled) {
    const user = await currentUser();
    if (!user) {
      redirect(`/signin?next=${encodeURIComponent("/billing")}`);
    }
    return <SettingsClient user={user} />;
  }
  return <SettingsClient user={null} />;
}
