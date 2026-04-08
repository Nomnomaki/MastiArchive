import { TrackerPage } from "@/components/tracker-page";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  return <TrackerPage scope="favorites" />;
}
