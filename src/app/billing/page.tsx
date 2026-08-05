import { currentUser } from "@/lib/auth-helpers";
import { SettingsClient } from "@/components/console/SettingsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — Telugu Captions",
};

export default async function BillingPage() {
  const user = await currentUser();
  return <SettingsClient user={user} />;
}
