import { TrackerPage } from "@/components/tracker-page";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  return <TrackerPage scope="Book" />;
}
