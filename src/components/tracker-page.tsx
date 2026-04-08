import { AuthScreen } from "@/components/auth-screen";
import { MinimalTracker } from "@/components/minimal-tracker";
import { getCurrentUser } from "@/lib/auth";
import type { TrackerScope } from "@/lib/types";

export async function TrackerPage({ scope }: { scope: TrackerScope }) {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  return <MinimalTracker scope={scope} userEmail={user.email} userId={user.id} />;
}
