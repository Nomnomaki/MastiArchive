import { NextResponse } from "next/server";

type ImdbSuggestionItem = {
  id?: string;
  l?: string;
  q?: string;
  qid?: string;
  s?: string;
  y?: number;
  yr?: string;
};

type RatingItem = {
  imdbId?: string;
  rating?: number | null;
};

function normalizeKind(value: string | null) {
  return value === "TV Show" ? "TV Show" : "Movie";
}

function isAcceptedSuggestion(kind: "Movie" | "TV Show", item: ImdbSuggestionItem) {
  if (kind === "Movie") {
    return item.qid === "movie" || item.qid === "tvMovie";
  }

  return item.qid === "tvSeries" || item.qid === "tvMiniSeries";
}

async function getRatings(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const params = new URLSearchParams();

  ids.forEach((id) => params.append("id", id));

  const response = await fetch(`https://api.agregarr.org/api/ratings?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return new Map<string, string>();
  }

  const payload = (await response.json()) as RatingItem[];

  return new Map(
    payload.map((item) => [
      item.imdbId ?? "",
      typeof item.rating === "number" ? item.rating.toFixed(1) : "",
    ]),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const kind = normalizeKind(searchParams.get("kind"));

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const endpoint = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(query)}.json`;
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

  const payload = (await response.json()) as { d?: ImdbSuggestionItem[] };
  const filtered = (payload.d ?? [])
    .filter((item) => isAcceptedSuggestion(kind, item))
    .slice(0, 6)
    .filter((item) => item.id && item.l);
  const ratings = await getRatings(filtered.map((item) => item.id ?? ""));
  const results = filtered
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      title: item.l ?? "",
      subtitle: item.s ?? item.q ?? "",
      year: item.yr ?? (typeof item.y === "number" ? String(item.y) : ""),
      rating: ratings.get(item.id ?? "") ?? "",
      showMeta: "",
      mangaMeta: "",
    }))
    .filter((item) => item.title);

  return NextResponse.json({ results });
}
