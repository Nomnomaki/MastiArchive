import { TrackerPage } from "@/components/tracker-page";

export const dynamic = "force-dynamic";

export default async function AnimePage() {
  return <TrackerPage scope="Anime" />;
}
