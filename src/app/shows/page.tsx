import { TrackerPage } from "@/components/tracker-page";

export const dynamic = "force-dynamic";

export default async function ShowsPage() {
  return <TrackerPage scope="TV Show" />;
}
