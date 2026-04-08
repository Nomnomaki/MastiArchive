import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEntryForUser, listEntriesForUser } from "@/lib/entries";
import { normalizeEntryKind } from "@/lib/types";
import type { EntryKind } from "@/lib/types";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function toApiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("entries_kind_check")) {
    return "Database schema is outdated. Run the media kind migration in Supabase and try again.";
  }

  if (error instanceof Error && error.message.includes("release_year")) {
    return "Database schema is outdated. Run the release year migration in Supabase and try again.";
  }

  if (error instanceof Error && error.message.includes("imdb_rating")) {
    return "Database schema is outdated. Run the IMDb rating migration in Supabase and try again.";
  }

  if (
    error instanceof Error &&
    (error.message.includes("show_meta") ||
      error.message.includes("current_season") ||
      error.message.includes("current_episode"))
  ) {
    return "Database schema is outdated. Run the TV show progress migration in Supabase and try again.";
  }

  if (error instanceof Error && (error.message.includes("manga_meta") || error.message.includes("current_chapter"))) {
    return "Database schema is outdated. Run the manga progress migration in Supabase and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to save entry.";
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return unauthorized();
  }

  const entries = await listEntriesForUser(user.id);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return unauthorized();
  }

  const body = (await request.json()) as {
    title?: string;
    creator?: string;
    releaseYear?: string;
    imdbRating?: string;
    showMeta?: string;
    currentSeason?: number;
    currentEpisode?: number;
    mangaMeta?: string;
    currentChapter?: number;
    kind?: EntryKind;
    pageNumber?: number;
    url?: string;
  };

  const kind = normalizeEntryKind(body.kind);

  if (!body.title?.trim() || !kind) {
    return NextResponse.json({ error: "Title and kind are required." }, { status: 400 });
  }

  if (kind === "Article" && !body.url?.trim()) {
    return NextResponse.json({ error: "Link is required for articles." }, { status: 400 });
  }

  try {
    const entry = await createEntryForUser({
      userId: user.id,
      title: body.title,
      creator: body.creator,
      releaseYear: body.releaseYear,
      imdbRating: body.imdbRating,
      showMeta: body.showMeta,
      currentSeason: body.currentSeason,
      currentEpisode: body.currentEpisode,
      mangaMeta: body.mangaMeta,
      currentChapter: body.currentChapter,
      kind,
      pageNumber: body.pageNumber,
      url: body.url,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 500 });
  }
}
