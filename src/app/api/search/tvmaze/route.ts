import { NextResponse } from "next/server";

type TvMazeShow = {
  id?: number;
};

type TvMazeEpisode = {
  season?: number | null;
  number?: number | null;
  type?: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId")?.trim() ?? "";

  if (!/^tt\d+$/.test(imdbId)) {
    return NextResponse.json({ meta: null });
  }

  const showResponse = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdbId)}`, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!showResponse.ok) {
    return NextResponse.json({ meta: null });
  }

  const show = (await showResponse.json()) as TvMazeShow;

  if (typeof show.id !== "number") {
    return NextResponse.json({ meta: null });
  }

  const episodesResponse = await fetch(`https://api.tvmaze.com/shows/${show.id}/episodes`, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!episodesResponse.ok) {
    return NextResponse.json({ meta: null });
  }

  const episodes = (await episodesResponse.json()) as TvMazeEpisode[];
  const episodesBySeason = new Map<number, number>();

  episodes.forEach((episode) => {
    const season = episode.season ?? 0;
    const number = episode.number ?? 0;

    if (season < 1 || number < 1 || episode.type === "significant_special") {
      return;
    }

    episodesBySeason.set(season, (episodesBySeason.get(season) ?? 0) + 1);
  });

  const seasons = Array.from(episodesBySeason.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([season, episodeCount]) => ({
      season,
      episodes: episodeCount,
    }));

  if (seasons.length === 0) {
    return NextResponse.json({ meta: null });
  }

  const meta = {
    seasonCount: seasons.length,
    totalEpisodes: seasons.reduce((sum, season) => sum + season.episodes, 0),
    seasons,
  };

  return NextResponse.json({ meta });
}
