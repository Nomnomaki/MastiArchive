import { AuthScreen } from "@/components/auth-screen";
import { MinimalTracker } from "@/components/minimal-tracker";
import { getCurrentUser } from "@/lib/auth";
import { listEntriesForUser } from "@/lib/entries";
import type { TrackerScope } from "@/lib/types";

export async function TrackerPage({ scope }: { scope: TrackerScope }) {
  const user = await getCurrentUser();

  if (!user) {
    return <AuthScreen />;
  }

  const entries = await listEntriesForUser(user.id);

  return <MinimalTracker initialEntries={entries} scope={scope} userEmail={user.email} />;
}
