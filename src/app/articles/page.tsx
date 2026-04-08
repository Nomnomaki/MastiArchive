import { TrackerPage } from "@/components/tracker-page";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  return <TrackerPage scope="Article" />;
}
