import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteEntryForUser, updateEntryForUser } from "@/lib/entries";
import { normalizeEntryKind } from "@/lib/types";
import type { EntryKind, EntryStatus } from "@/lib/types";

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

  return "Unable to update entry.";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
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
    status?: EntryStatus;
    favorite?: boolean;
  };

  try {
    const entry = await updateEntryForUser({
      userId: user.id,
      entryId: id,
      title: body.title,
      creator: body.creator,
      releaseYear: body.releaseYear,
      imdbRating: body.imdbRating,
      showMeta: body.showMeta,
      currentSeason: body.currentSeason,
      currentEpisode: body.currentEpisode,
      mangaMeta: body.mangaMeta,
      currentChapter: body.currentChapter,
      kind: normalizeEntryKind(body.kind) ?? undefined,
      pageNumber: body.pageNumber,
      url: body.url,
      status: body.status,
      favorite: body.favorite,
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const deleted = await deleteEntryForUser({
    userId: user.id,
    entryId: id,
  });

  if (!deleted) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
