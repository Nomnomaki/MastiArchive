import { NextResponse } from "next/server";

type AniListMedia = {
  id: number;
  title?: {
    english?: string | null;
    romaji?: string | null;
    native?: string | null;
  };
  startDate?: {
    year?: number | null;
  };
  averageScore?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  studios?: {
    nodes?: Array<{ name?: string | null }>;
  };
  staff?: {
    edges?: Array<{
      role?: string | null;
      node?: {
        name?: {
          full?: string | null;
        } | null;
      } | null;
    }>;
  };
};

function normalizeKind(value: string | null) {
  return value === "Manga" ? "Manga" : "Anime";
}

function getTitle(media: AniListMedia) {
  return media.title?.english ?? media.title?.romaji ?? media.title?.native ?? "";
}

function getAnimeCreator(media: AniListMedia) {
  const director = media.staff?.edges?.find((edge) => edge.role?.toLowerCase().includes("director"))?.node?.name?.full;

  return director ?? media.studios?.nodes?.[0]?.name ?? "";
}

function getMangaCreator(media: AniListMedia) {
  return media.staff?.edges?.find((edge) => edge.role?.toLowerCase().includes("story"))?.node?.name?.full ?? "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const kind = normalizeKind(searchParams.get("kind"));

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const graphqlQuery = `
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 6) {
        media(search: $search, type: $type) {
          id
          title {
            english
            romaji
            native
          }
          startDate {
            year
          }
          averageScore
          episodes
          chapters
          volumes
          studios(isMain: true) {
            nodes {
              name
            }
          }
          staff(sort: [RELEVANCE]) {
            edges {
              role
              node {
                name {
                  full
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: graphqlQuery,
      variables: {
        search: query,
        type: kind === "Anime" ? "ANIME" : "MANGA",
      },
    }),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return NextResponse.json({ results: [] });
  }

  const payload = (await response.json()) as { data?: { Page?: { media?: AniListMedia[] } } };
  const results = (payload.data?.Page?.media ?? [])
    .map((media) => {
      const title = getTitle(media);
      const creator = kind === "Anime" ? getAnimeCreator(media) : getMangaCreator(media);
      const year = typeof media.startDate?.year === "number" ? String(media.startDate.year) : "";
      const rating = typeof media.averageScore === "number" ? String(media.averageScore) : "";

      return {
        id: String(media.id),
        title,
        subtitle: creator,
        year,
        rating,
        showMeta:
          kind === "Anime" && typeof media.episodes === "number" && media.episodes > 0
            ? JSON.stringify({
                seasonCount: 1,
                totalEpisodes: media.episodes,
                seasons: [{ season: 1, episodes: media.episodes }],
              })
            : "",
        mangaMeta:
          kind === "Manga"
            ? JSON.stringify({
                totalChapters: typeof media.chapters === "number" ? media.chapters : 0,
                totalVolumes: typeof media.volumes === "number" ? media.volumes : 0,
              })
            : "",
      };
    })
    .filter((item) => item.title);

  return NextResponse.json({ results });
}
