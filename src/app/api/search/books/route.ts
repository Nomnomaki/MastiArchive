import { NextResponse } from "next/server";

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const endpoint = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=6`;
  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return NextResponse.json({ results: [] });
  }

  const payload = (await response.json()) as { docs?: OpenLibraryDoc[] };
  const results = (payload.docs ?? [])
    .slice(0, 6)
    .map((item) => ({
      id: item.key ?? crypto.randomUUID(),
      title: item.title ?? "",
      subtitle: item.author_name?.[0] ?? "",
      year: typeof item.first_publish_year === "number" ? String(item.first_publish_year) : "",
      rating: "",
      showMeta: "",
      mangaMeta: "",
    }))
    .filter((item) => item.title);

  return NextResponse.json({ results });
}
