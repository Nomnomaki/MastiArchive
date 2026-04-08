import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeEntryKind } from "@/lib/types";
import type { Entry, EntryKind, EntryRecord, EntryStatus } from "@/lib/types";

type EntryRow = {
  id: string;
  user_id: string;
  title: string;
  creator: string;
  release_year: string | null;
  imdb_rating: string | null;
  show_meta: string | null;
  current_season: number | null;
  current_episode: number | null;
  manga_meta: string | null;
  current_chapter: number | null;
  kind: string;
  status: string;
  favorite: boolean | null;
  page_number: number | null;
  url: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeUrl(url: string | undefined) {
  const trimmed = url?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function normalizeStatus(value: unknown): EntryStatus {
  if (value === "To start" || value === "In progress" || value === "Done") {
    return value;
  }

  if (value === "Queued") {
    return "To start";
  }

  return "To start";
}

function clampPageNumber(pageNumber: number | undefined) {
  if (typeof pageNumber !== "number" || Number.isNaN(pageNumber)) {
    return 0;
  }

  return Math.max(0, Math.round(pageNumber));
}

type ShowMeta = {
  seasonCount: number;
  totalEpisodes: number;
  seasons: Array<{ season: number; episodes: number }>;
};

type MangaMeta = {
  totalChapters: number;
  totalVolumes: number;
};

function clampCounter(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function parseShowMeta(value: string | undefined): ShowMeta | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ShowMeta>;

    if (!Array.isArray(parsed.seasons)) {
      return null;
    }

    const seasons = parsed.seasons
      .map((item) => ({
        season: clampCounter(item?.season),
        episodes: clampCounter(item?.episodes),
      }))
      .filter((item) => item.season > 0 && item.episodes > 0)
      .sort((left, right) => left.season - right.season);

    if (seasons.length === 0) {
      return null;
    }

    const totalEpisodes = seasons.reduce((sum, item) => sum + item.episodes, 0);

    return {
      seasonCount: seasons.length,
      totalEpisodes,
      seasons,
    };
  } catch {
    return null;
  }
}

function parseMangaMeta(value: string | undefined): MangaMeta | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<MangaMeta>;

    return {
      totalChapters: clampCounter(parsed.totalChapters),
      totalVolumes: clampCounter(parsed.totalVolumes),
    };
  } catch {
    return null;
  }
}

function clampShowProgress(currentSeason: number, currentEpisode: number, meta: ShowMeta | null) {
  const safeEpisode = clampCounter(currentEpisode);

  if (!meta) {
    return {
      currentSeason: clampCounter(currentSeason),
      currentEpisode: safeEpisode,
    };
  }

  const firstSeason = meta.seasons[0]?.season ?? 1;
  const matchingSeason = meta.seasons.find((season) => season.season === clampCounter(currentSeason));
  const fallbackSeason = clampCounter(currentSeason) <= firstSeason ? meta.seasons[0] : meta.seasons.at(-1);
  const seasonMeta = matchingSeason ?? fallbackSeason ?? meta.seasons[0];

  return {
    currentSeason: seasonMeta?.season ?? firstSeason,
    currentEpisode: Math.min(safeEpisode, seasonMeta?.episodes ?? safeEpisode),
  };
}

function deriveStatus(kind: EntryKind, pageNumber: number, currentStatus?: EntryStatus) {
  if (currentStatus === "Done") {
    return "Done";
  }

  if (kind === "Book" && pageNumber > 0) {
    return "In progress";
  }

  return currentStatus ?? "To start";
}

function mapEntryRow(row: EntryRow): EntryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    creator: row.creator,
    releaseYear: row.release_year ?? "",
    imdbRating: row.imdb_rating ?? "",
    showMeta: row.show_meta ?? "",
    currentSeason: clampCounter(row.current_season ?? 0),
    currentEpisode: clampCounter(row.current_episode ?? 0),
    mangaMeta: row.manga_meta ?? "",
    currentChapter: clampCounter(row.current_chapter ?? 0),
    kind: normalizeEntryKind(row.kind) ?? "Article",
    status: normalizeStatus(row.status),
    favorite: Boolean(row.favorite),
    pageNumber: clampPageNumber(row.page_number ?? 0),
    url: normalizeUrl(row.url ?? ""),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRecord(record: EntryRecord) {
  const kind = normalizeEntryKind(record.kind) ?? "Article";
  const pageNumber = clampPageNumber(record.pageNumber);
  const showMeta = kind === "TV Show" || kind === "Anime" ? parseShowMeta(record.showMeta) : null;
  const mangaMeta = kind === "Manga" ? parseMangaMeta(record.mangaMeta) : null;
  const showProgress =
    kind === "TV Show" || kind === "Anime"
      ? clampShowProgress(record.currentSeason, record.currentEpisode, showMeta)
      : { currentSeason: 0, currentEpisode: 0 };
  const status = deriveStatus(kind, pageNumber, normalizeStatus(record.status));

  return {
    ...record,
    creator: record.creator?.trim() ?? "",
    releaseYear: record.releaseYear?.trim() ?? "",
    imdbRating: record.imdbRating?.trim() ?? "",
    showMeta: showMeta ? JSON.stringify(showMeta) : "",
    currentSeason: showProgress.currentSeason,
    currentEpisode: showProgress.currentEpisode,
    mangaMeta: mangaMeta ? JSON.stringify(mangaMeta) : "",
    currentChapter:
      kind === "Manga"
        ? (mangaMeta?.totalChapters ? Math.min(clampCounter(record.currentChapter), mangaMeta.totalChapters) : clampCounter(record.currentChapter))
        : 0,
    kind,
    status,
    favorite: Boolean(record.favorite),
    pageNumber,
    url: normalizeUrl(record.url),
  } satisfies EntryRecord;
}

function sanitizeEntry(record: EntryRecord): Entry {
  const normalized = normalizeRecord(record);
  const { userId: _userId, ...entry } = normalized;
  return entry;
}

function toDatabaseEntry(record: EntryRecord) {
  return {
    id: record.id,
    user_id: record.userId,
    title: record.title,
    creator: record.creator,
    release_year: record.releaseYear,
    imdb_rating: record.imdbRating,
    show_meta: record.showMeta,
    current_season: record.currentSeason,
    current_episode: record.currentEpisode,
    manga_meta: record.mangaMeta,
    current_chapter: record.currentChapter,
    kind: record.kind,
    status: record.status,
    favorite: record.favorite,
    page_number: record.pageNumber,
    url: record.url,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export async function listEntriesForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("entries")
    .select("id, user_id, title, creator, release_year, imdb_rating, show_meta, current_season, current_episode, manga_meta, current_chapter, kind, status, favorite, page_number, url, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as EntryRow[]).map((row) => sanitizeEntry(mapEntryRow(row)));
}

export async function createEntryForUser(input: {
  userId: string;
  title: string;
  creator?: string;
  releaseYear?: string;
  imdbRating?: string;
  showMeta?: string;
  currentSeason?: number;
  currentEpisode?: number;
  mangaMeta?: string;
  currentChapter?: number;
  kind: EntryKind;
  pageNumber?: number;
  url?: string;
}) {
  const now = new Date().toISOString();
  const kind = normalizeEntryKind(input.kind) ?? "Article";
  const pageNumber = kind === "Book" ? clampPageNumber(input.pageNumber) : 0;

  const entry = normalizeRecord({
    id: randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    creator: input.creator?.trim() ?? "",
    releaseYear: input.releaseYear?.trim() ?? "",
    imdbRating: input.imdbRating?.trim() ?? "",
    showMeta: input.showMeta ?? "",
    currentSeason: input.currentSeason ?? (kind === "TV Show" || kind === "Anime" ? 1 : 0),
    currentEpisode: input.currentEpisode ?? 0,
    mangaMeta: input.mangaMeta ?? "",
    currentChapter: input.currentChapter ?? 0,
    kind,
    status: deriveStatus(kind, pageNumber),
    favorite: false,
    pageNumber,
    url: kind === "Article" ? normalizeUrl(input.url) : "",
    createdAt: now,
    updatedAt: now,
  });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("entries")
    .insert(toDatabaseEntry(entry))
    .select("id, user_id, title, creator, release_year, imdb_rating, show_meta, current_season, current_episode, manga_meta, current_chapter, kind, status, favorite, page_number, url, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return sanitizeEntry(mapEntryRow(data as EntryRow));
}

export async function updateEntryForUser(input: {
  userId: string;
  entryId: string;
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
}) {
  const supabase = getSupabaseAdmin();
  const { data: currentRow, error: currentError } = await supabase
    .from("entries")
    .select("id, user_id, title, creator, release_year, imdb_rating, show_meta, current_season, current_episode, manga_meta, current_chapter, kind, status, favorite, page_number, url, created_at, updated_at")
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }

  if (!currentRow) {
    return null;
  }

  const entry = normalizeRecord(mapEntryRow(currentRow as EntryRow));

  if (typeof input.title === "string") {
    entry.title = input.title.trim();
  }

  if (typeof input.creator === "string") {
    entry.creator = input.creator.trim();
  }

  if (typeof input.releaseYear === "string") {
    entry.releaseYear = input.releaseYear.trim();
  }

  if (typeof input.imdbRating === "string") {
    entry.imdbRating = input.imdbRating.trim();
  }

  if (typeof input.showMeta === "string") {
    entry.showMeta = input.showMeta;
  }

  if (typeof input.currentSeason === "number") {
    entry.currentSeason = clampCounter(input.currentSeason);
  }

  if (typeof input.currentEpisode === "number") {
    entry.currentEpisode = clampCounter(input.currentEpisode);
  }

  if (typeof input.mangaMeta === "string") {
    entry.mangaMeta = input.mangaMeta;
  }

  if (typeof input.currentChapter === "number") {
    entry.currentChapter = clampCounter(input.currentChapter);
  }

  if (typeof input.kind === "string") {
    entry.kind = normalizeEntryKind(input.kind) ?? entry.kind;
  }

  if (typeof input.pageNumber === "number" && entry.kind === "Book") {
    entry.pageNumber = clampPageNumber(input.pageNumber);

    if (entry.status !== "Done") {
      entry.status = deriveStatus(entry.kind, entry.pageNumber);
    }
  }

  if (typeof input.url === "string") {
    entry.url = entry.kind === "Article" ? normalizeUrl(input.url) : "";
  }

  if (typeof input.status === "string") {
    entry.status = normalizeStatus(input.status);
  }

  if (typeof input.favorite === "boolean") {
    entry.favorite = input.favorite;
  }

  if (entry.kind !== "Book") {
    entry.pageNumber = 0;
  }

  if (entry.kind !== "Article") {
    entry.url = "";
  }

  if (entry.kind !== "TV Show" && entry.kind !== "Anime") {
    entry.showMeta = "";
    entry.currentSeason = 0;
    entry.currentEpisode = 0;
  }

  if (entry.kind !== "Manga") {
    entry.mangaMeta = "";
    entry.currentChapter = 0;
  }

  entry.updatedAt = new Date().toISOString();

  const normalized = normalizeRecord(entry);
  const { data, error } = await supabase
    .from("entries")
    .update(toDatabaseEntry(normalized))
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .select("id, user_id, title, creator, release_year, imdb_rating, show_meta, current_season, current_episode, manga_meta, current_chapter, kind, status, favorite, page_number, url, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return sanitizeEntry(mapEntryRow(data as EntryRow));
}

export async function deleteEntryForUser(input: { userId: string; entryId: string }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
