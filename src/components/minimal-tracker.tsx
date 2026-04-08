"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { entryKinds } from "@/lib/types";
import type { Entry, EntryKind, EntryStatus, TrackerScope } from "@/lib/types";

type DraftState = {
  kind: EntryKind;
  title: string;
  creator: string;
  releaseYear: string;
  imdbRating: string;
  showMeta: string;
  currentSeason: string;
  currentEpisode: string;
  mangaMeta: string;
  currentChapter: string;
  pageNumber: string;
  url: string;
};

type SearchSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  year: string;
  rating: string;
  showMeta: string;
  mangaMeta: string;
};

type ShowMeta = {
  seasonCount: number;
  totalEpisodes: number;
  seasons: Array<{ season: number; episodes: number }>;
};

type MangaMeta = {
  totalChapters: number;
  totalVolumes: number;
};

type EntryCache = {
  userId: string;
  entries: Entry[];
};

let entryCache: EntryCache | null = null;
let entryRequest: Promise<Entry[]> | null = null;

const tabs: Array<{ href: string; label: string; scope: TrackerScope }> = [
  { href: "/", label: "All", scope: "all" },
  { href: "/books", label: "Books", scope: "Book" },
  { href: "/movies", label: "Movies", scope: "Movie" },
  { href: "/shows", label: "TV Shows", scope: "TV Show" },
  { href: "/anime", label: "Anime", scope: "Anime" },
  { href: "/manga", label: "Manga", scope: "Manga" },
  { href: "/articles", label: "Articles", scope: "Article" },
  { href: "/favorites", label: "Favorites", scope: "favorites" },
  { href: "/archive", label: "Archive", scope: "archive" },
];

const pageCopy: Record<
  TrackerScope,
  {
    eyebrow: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyCopy: string;
  }
> = {
  all: {
    eyebrow: "Personal archive",
    title: "Keep books, movies, shows, and links in one place.",
    description: "Active items stay here. Finished ones move to archive automatically.",
    emptyTitle: "Nothing active right now.",
    emptyCopy: "Add your first item to start the archive.",
  },
  Book: {
    eyebrow: "Books",
    title: "Track what you are reading without extra noise.",
    description: "Only active books stay here. Finished books move to archive.",
    emptyTitle: "No active books.",
    emptyCopy: "Add a book to start this shelf.",
  },
  Movie: {
    eyebrow: "Movies",
    title: "Keep a simple watchlist and mark progress quickly.",
    description: "Only active movies stay here. Finished movies move to archive.",
    emptyTitle: "No active movies.",
    emptyCopy: "Add a movie to start this shelf.",
  },
  "TV Show": {
    eyebrow: "TV Shows",
    title: "Track shows with the same simple flow.",
    description: "Only active shows stay here. Finished shows move to archive.",
    emptyTitle: "No active TV shows.",
    emptyCopy: "Add a TV show to start this shelf.",
  },
  Anime: {
    eyebrow: "Anime",
    title: "Track anime with AniList search and episode progress.",
    description: "Only active anime stay here. Finished anime move to archive.",
    emptyTitle: "No active anime.",
    emptyCopy: "Add an anime title to start this shelf.",
  },
  Manga: {
    eyebrow: "Manga",
    title: "Track manga with AniList search and chapter progress.",
    description: "Only active manga stay here. Finished manga move to archive.",
    emptyTitle: "No active manga.",
    emptyCopy: "Add a manga title to start this shelf.",
  },
  Article: {
    eyebrow: "Articles",
    title: "Save links you want to return to later.",
    description: "Only unfinished links stay here. Done ones move to archive.",
    emptyTitle: "No active articles.",
    emptyCopy: "Add an article or video link to start this shelf.",
  },
  favorites: {
    eyebrow: "Favorites",
    title: "The entries you want to keep especially close.",
    description: "Favorites can be active or archived. This shelf pulls them together in one place.",
    emptyTitle: "No favorites yet.",
    emptyCopy: "Mark any entry as favorite and it will appear here.",
  },
  archive: {
    eyebrow: "Archive",
    title: "Completed items live here.",
    description: "Everything marked done is moved out of the active shelves and kept here.",
    emptyTitle: "Archive is empty.",
    emptyCopy: "Completed items will show up here automatically.",
  },
};

function createDefaultDraft(scope: TrackerScope): DraftState {
  return {
    kind: scope === "all" || scope === "archive" || scope === "favorites" ? "Book" : scope,
    title: "",
    creator: "",
    releaseYear: "",
    imdbRating: "",
    showMeta: "",
    currentSeason: "",
    currentEpisode: "",
    mangaMeta: "",
    currentChapter: "",
    pageNumber: "",
    url: "",
  };
}

function clampPageNumber(value: string) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function clampCounter(value: string) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function parseShowMeta(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as ShowMeta;

    if (!Array.isArray(parsed.seasons)) {
      return null;
    }

    const seasons = parsed.seasons
      .map((season) => ({
        season: clampCounter(String(season.season)),
        episodes: clampCounter(String(season.episodes)),
      }))
      .filter((season) => season.season > 0 && season.episodes > 0)
      .sort((left, right) => left.season - right.season);

    if (seasons.length === 0) {
      return null;
    }

    return {
      seasonCount: seasons.length,
      totalEpisodes: seasons.reduce((sum, season) => sum + season.episodes, 0),
      seasons,
    } satisfies ShowMeta;
  } catch {
    return null;
  }
}

function parseMangaMeta(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<MangaMeta>;

    return {
      totalChapters: clampCounter(String(parsed.totalChapters ?? 0)),
      totalVolumes: clampCounter(String(parsed.totalVolumes ?? 0)),
    } satisfies MangaMeta;
  } catch {
    return null;
  }
}

function getShowProgress(metaValue: string, currentSeason: number, currentEpisode: number) {
  const meta = parseShowMeta(metaValue);

  if (!meta) {
    return null;
  }

  const firstSeason = meta.seasons[0]?.season ?? 1;
  const seasonMeta = meta.seasons.find((season) => season.season === currentSeason) ?? meta.seasons[0];
  const safeSeason = seasonMeta?.season ?? firstSeason;
  const safeEpisode = Math.min(Math.max(0, currentEpisode), seasonMeta?.episodes ?? currentEpisode);
  const watchedBefore = meta.seasons
    .filter((season) => season.season < safeSeason)
    .reduce((sum, season) => sum + season.episodes, 0);
  const watchedEpisodes = watchedBefore + safeEpisode;

  return {
    seasonCount: meta.seasonCount,
    totalEpisodes: meta.totalEpisodes,
    currentSeason: safeSeason,
    currentEpisode: safeEpisode,
    currentSeasonEpisodeCount: seasonMeta?.episodes ?? 0,
    watchedEpisodes,
    remainingEpisodes: Math.max(meta.totalEpisodes - watchedEpisodes, 0),
  };
}

function getMangaProgress(metaValue: string, currentChapter: number) {
  const meta = parseMangaMeta(metaValue);

  if (!meta) {
    return null;
  }

  const chapter = Math.max(0, currentChapter);

  return {
    totalChapters: meta.totalChapters,
    totalVolumes: meta.totalVolumes,
    currentChapter: meta.totalChapters > 0 ? Math.min(chapter, meta.totalChapters) : chapter,
    remainingChapters: meta.totalChapters > 0 ? Math.max(meta.totalChapters - Math.min(chapter, meta.totalChapters), 0) : 0,
  };
}

const shortDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

function formatDate(value: string) {
  return shortDateFormatter.format(new Date(value));
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function getVisibleItems(items: Entry[], scope: TrackerScope) {
  if (scope === "favorites") {
    return items.filter((item) => item.favorite);
  }

  if (scope === "archive") {
    return items.filter((item) => item.status === "Done");
  }

  const activeItems = items.filter((item) => item.status !== "Done");

  if (scope === "all") {
    return activeItems;
  }

  return activeItems.filter((item) => item.kind === scope);
}

function sortEntries(items: Entry[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function getStatusCopy(status: EntryStatus) {
  if (status === "Done") {
    return "Completed";
  }

  if (status === "In progress") {
    return "Ongoing";
  }

  return "To start";
}

async function readPayload<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

async function fetchEntries() {
  if (entryRequest) {
    return entryRequest;
  }

  entryRequest = fetch("/api/entries")
    .then((response) => readPayload<{ entries?: Entry[]; error?: string }>(response).then((payload) => ({ response, payload })))
    .then(({ response, payload }) => {
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load entries.");
      }

      return payload.entries ?? [];
    })
    .finally(() => {
      entryRequest = null;
    });

  return entryRequest;
}

function updateEntryCache(userId: string, entries: Entry[]) {
  entryCache = {
    userId,
    entries,
  };
}

export function MinimalTracker({
  scope,
  userEmail,
  userId,
}: {
  scope: TrackerScope;
  userEmail: string;
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Entry[]>(() => (entryCache?.userId === userId ? entryCache.entries : []));
  const [isLoadingEntries, setIsLoadingEntries] = useState(() => !(entryCache?.userId === userId));
  const [draft, setDraft] = useState(() => createDefaultDraft(scope));
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingShowMeta, setIsLoadingShowMeta] = useState(false);
  const [debouncedTitle, setDebouncedTitle] = useState(draft.title);
  const searchCacheRef = useRef(new Map<string, SearchSuggestion[]>());
  const showMetaCacheRef = useRef(new Map<string, ShowMeta | null>());
  const itemsRef = useRef(items);

  const page = pageCopy[scope];
  const visibleItems = getVisibleItems(items, scope);
  const activeKind = scope === "all" || scope === "archive" || scope === "favorites" ? draft.kind : scope;
  const archiveCount = items.filter((item) => item.status === "Done").length;
  const favoritesCount = items.filter((item) => item.favorite).length;
  const shouldSearchBooks = activeKind === "Book";
  const shouldSearchAniList = activeKind === "Anime" || activeKind === "Manga";
  const shouldSearchImdb = activeKind === "Movie" || activeKind === "TV Show";
  const shouldSearchSuggestions = shouldSearchBooks || shouldSearchImdb || shouldSearchAniList;
  const searchTerm = debouncedTitle.trim();
  const canSave = Boolean(draft.title.trim()) && (activeKind !== "Article" || Boolean(draft.url.trim()));

  function commitItems(next: Entry[]) {
    itemsRef.current = next;
    setItems(next);
    updateEntryCache(userId, next);
  }

  useEffect(() => {
    if (entryCache?.userId === userId) {
      setItems(entryCache.entries);
      setIsLoadingEntries(false);
      return;
    }

    let isMounted = true;
    setIsLoadingEntries(true);

    fetchEntries()
      .then((entries) => {
        if (!isMounted) {
          return;
        }

        updateEntryCache(userId, entries);
        commitItems(entries);
      })
      .catch((loadError) => {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load entries.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingEntries(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    tabs
      .filter((tab) => tab.href !== "/" || scope !== "all")
      .filter((tab) => tab.scope !== scope)
      .forEach((tab) => {
        router.prefetch(tab.href);
      });
  }, [router, scope]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedTitle(draft.title);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [draft.title]);

  useEffect(() => {
    if (!shouldSearchSuggestions || searchTerm.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ q: searchTerm });
    const endpoint = shouldSearchBooks
      ? "/api/search/books"
      : shouldSearchAniList
        ? "/api/search/anilist"
        : "/api/search/imdb";

    if (shouldSearchImdb || shouldSearchAniList) {
      params.set("kind", activeKind);
    }

    const cacheKey = `${endpoint}?${params.toString()}`;
    const cached = searchCacheRef.current.get(cacheKey);

    if (cached) {
      setSuggestions(cached);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);

    fetch(cacheKey, {
      signal: controller.signal,
    })
      .then((response) => readPayload<{ results?: SearchSuggestion[] }>(response))
      .then((payload) => {
        if (!controller.signal.aborted) {
          const results = payload.results ?? [];
          searchCacheRef.current.set(cacheKey, results);
          setSuggestions(results);
        }
      })
      .catch((searchError: unknown) => {
        if (searchError instanceof Error && searchError.name === "AbortError") {
          return;
        }

        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingSuggestions(false);
        }
      });

    return () => controller.abort();
  }, [activeKind, searchTerm, shouldSearchAniList, shouldSearchBooks, shouldSearchImdb, shouldSearchSuggestions]);

  function updateDraft<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSuggestionSelect(suggestion: SearchSuggestion) {
    updateDraft("title", suggestion.title);
    updateDraft("creator", suggestion.subtitle);
    updateDraft("releaseYear", suggestion.year);
    updateDraft("imdbRating", suggestion.rating);
    updateDraft("showMeta", suggestion.showMeta);
    updateDraft("currentSeason", "");
    updateDraft("currentEpisode", "");
    updateDraft("mangaMeta", suggestion.mangaMeta);
    updateDraft("currentChapter", "");

    if (activeKind === "Anime") {
      updateDraft("currentSeason", "1");
      updateDraft("currentEpisode", "0");
      setSuggestions([]);
      return;
    }

    if (activeKind === "Manga") {
      updateDraft("currentChapter", "0");
      setSuggestions([]);
      return;
    }

    if (activeKind !== "TV Show") {
      setSuggestions([]);
      return;
    }

    const cachedMeta = showMetaCacheRef.current.get(suggestion.id);

    if (cachedMeta !== undefined) {
      const firstSeason = cachedMeta?.seasons?.[0]?.season;
      updateDraft("showMeta", cachedMeta ? JSON.stringify(cachedMeta) : "");
      updateDraft("currentSeason", typeof firstSeason === "number" ? String(firstSeason) : "1");
      updateDraft("currentEpisode", "0");
      setSuggestions([]);
      return;
    }

    setIsLoadingShowMeta(true);

    try {
      const params = new URLSearchParams({ imdbId: suggestion.id });
      const response = await fetch(`/api/search/tvmaze?${params.toString()}`);
      const payload = await readPayload<{ meta?: ShowMeta | null }>(response);
      const firstSeason = payload.meta?.seasons?.[0]?.season;
      showMetaCacheRef.current.set(suggestion.id, payload.meta ?? null);

      updateDraft("showMeta", payload.meta ? JSON.stringify(payload.meta) : "");
      updateDraft("currentSeason", typeof firstSeason === "number" ? String(firstSeason) : "1");
      updateDraft("currentEpisode", "0");
    } catch {
      showMetaCacheRef.current.set(suggestion.id, null);
      updateDraft("showMeta", "");
      updateDraft("currentSeason", "1");
      updateDraft("currentEpisode", "0");
    } finally {
      setIsLoadingShowMeta(false);
      setSuggestions([]);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: activeKind,
          title: draft.title,
          creator:
            activeKind === "Book" ||
            activeKind === "Movie" ||
            activeKind === "TV Show" ||
            activeKind === "Anime" ||
            activeKind === "Manga"
              ? draft.creator
              : "",
          releaseYear:
            activeKind === "Book" ||
            activeKind === "Movie" ||
            activeKind === "TV Show" ||
            activeKind === "Anime" ||
            activeKind === "Manga"
              ? draft.releaseYear
              : "",
          imdbRating: activeKind === "Movie" || activeKind === "TV Show" ? draft.imdbRating : "",
          showMeta: activeKind === "TV Show" || activeKind === "Anime" ? draft.showMeta : "",
          currentSeason: activeKind === "TV Show" || activeKind === "Anime" ? clampCounter(draft.currentSeason || "1") : 0,
          currentEpisode: activeKind === "TV Show" || activeKind === "Anime" ? clampCounter(draft.currentEpisode) : 0,
          mangaMeta: activeKind === "Manga" ? draft.mangaMeta : "",
          currentChapter: activeKind === "Manga" ? clampCounter(draft.currentChapter) : 0,
          pageNumber: activeKind === "Book" ? clampPageNumber(draft.pageNumber) : 0,
          url: activeKind === "Article" ? draft.url : "",
        }),
      });

      const payload = await readPayload<{ entry?: Entry; error?: string }>(response);

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error || "Unable to save entry.");
      }

      const entry = payload.entry;

      commitItems([entry, ...itemsRef.current]);
      setDraft(createDefaultDraft(scope));
      setSuggestions([]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save entry.");
    } finally {
      setIsSaving(false);
    }
  }

  async function patchEntry(entryId: string, patch: Partial<Entry>, optimistic?: Partial<Entry>) {
    const previous = itemsRef.current;

    if (optimistic) {
      const optimisticItems = sortEntries(
        previous.map((item) =>
          item.id === entryId
            ? {
                ...item,
                ...optimistic,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      commitItems(optimisticItems);
    }

    const response = await fetch(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    const payload = await readPayload<{ entry?: Entry; error?: string }>(response);

    if (!response.ok || !payload.entry) {
      if (optimistic) {
        commitItems(previous);
      }

      throw new Error(payload.error || "Unable to update entry.");
    }

    const entry = payload.entry;
    const next = sortEntries(itemsRef.current.map((item) => (item.id === entryId ? entry : item)));
    commitItems(next);
  }

  async function deleteEntry(entryId: string, optimistic = true) {
    const previous = itemsRef.current;

    if (optimistic) {
      commitItems(previous.filter((item) => item.id !== entryId));
    }

    const response = await fetch(`/api/entries/${entryId}`, {
      method: "DELETE",
    });

    const payload = await readPayload<{ ok?: boolean; error?: string }>(response);

    if (!response.ok || !payload.ok) {
      if (optimistic) {
        commitItems(previous);
      }

      throw new Error(payload.error || "Unable to remove entry.");
    }
  }

  async function handleStatusChange(item: Entry, status: EntryStatus) {
    setError("");

    try {
      await patchEntry(item.id, { status }, { status });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update entry.");
    }
  }

  async function handleBookPageChange(item: Entry, value: string) {
    setError("");

    try {
      const pageNumber = clampPageNumber(value);
      await patchEntry(item.id, { pageNumber }, { pageNumber });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update entry.");
    }
  }

  async function handleShowProgressChange(
    item: Entry,
    patch: { currentSeason?: string; currentEpisode?: string },
  ) {
    setError("");

    try {
      const nextSeason =
        typeof patch.currentSeason === "string" ? clampCounter(patch.currentSeason) : item.currentSeason;
      const nextEpisode =
        typeof patch.currentEpisode === "string" ? clampCounter(patch.currentEpisode) : item.currentEpisode;
      const status = item.status === "Done" ? "Done" : nextEpisode > 0 || nextSeason > 1 ? "In progress" : "To start";

      await patchEntry(item.id, {
        currentSeason: nextSeason,
        currentEpisode: nextEpisode,
        status,
      }, {
        currentSeason: nextSeason,
        currentEpisode: nextEpisode,
        status,
      });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update show progress.");
    }
  }

  async function handleMangaChapterChange(item: Entry, value: string) {
    setError("");

    try {
      const nextChapter = clampCounter(value);
      const status = item.status === "Done" ? "Done" : nextChapter > 0 ? "In progress" : "To start";

      await patchEntry(item.id, {
        currentChapter: nextChapter,
        status,
      }, {
        currentChapter: nextChapter,
        status,
      });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update manga progress.");
    }
  }

  async function handleDelete(item: Entry) {
    setError("");

    try {
      await deleteEntry(item.id, true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to remove entry.");
    }
  }

  async function handleFavoriteToggle(item: Entry) {
    setError("");

    try {
      await patchEntry(item.id, { favorite: !item.favorite }, { favorite: !item.favorite });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update favorite.");
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setError("");

    try {
      entryCache = null;
      entryRequest = null;
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  function renderFormFields() {
    return (
      <>
        {scope === "all" ? (
          <select value={draft.kind} onChange={(event) => updateDraft("kind", event.target.value as EntryKind)}>
            {entryKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        ) : null}

        <input
          placeholder={
            activeKind === "Book"
              ? "Search Open Library for a book"
              : activeKind === "Anime"
                ? "Search AniList for anime"
                : activeKind === "Manga"
                  ? "Search AniList for manga"
              : activeKind === "Movie"
                ? "Search IMDb for a movie"
                : activeKind === "TV Show"
                ? "Search IMDb for a TV show"
                : activeKind === "Article"
                  ? "Article name"
                  : "Book title"
          }
          value={draft.title}
          onChange={(event) => {
            updateDraft("title", event.target.value);

            if (shouldSearchSuggestions) {
              updateDraft("creator", "");
              updateDraft("releaseYear", "");
              updateDraft("imdbRating", "");
              updateDraft("showMeta", "");
              updateDraft("currentSeason", "");
              updateDraft("currentEpisode", "");
              updateDraft("mangaMeta", "");
              updateDraft("currentChapter", "");
            }
          }}
        />

        {shouldSearchSuggestions ? (
          <div className="form-field-wide imdb-block">
            {isLoadingSuggestions ? (
              <p className="field-hint">
                {shouldSearchBooks ? "Searching books..." : shouldSearchAniList ? "Searching AniList..." : "Searching IMDb..."}
              </p>
            ) : null}
            {!isLoadingSuggestions && draft.title.trim().length > 0 && draft.title.trim().length < 2 ? (
              <p className="field-hint">Type at least 2 letters to search.</p>
            ) : null}
            {activeKind === "TV Show" && isLoadingShowMeta ? <p className="field-hint">Loading seasons and episodes...</p> : null}
            {!isLoadingSuggestions && suggestions.length > 0 ? (
              <div className="imdb-results">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    className="imdb-result"
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    <div className="imdb-result-copy">
                      <strong>{suggestion.title}</strong>
                      <span>
                        {[
                          suggestion.subtitle,
                          suggestion.year,
                          suggestion.rating
                            ? `${shouldSearchAniList ? "AniList" : "IMDb"} ${suggestion.rating}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" - ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {!isLoadingSuggestions && searchTerm.length >= 2 && suggestions.length === 0 ? (
              <p className="field-hint">No matches found. You can still save it manually.</p>
            ) : null}
            {activeKind === "TV Show" && !isLoadingShowMeta && parseShowMeta(draft.showMeta) ? (
              <p className="field-hint">
                {(() => {
                  const meta = parseShowMeta(draft.showMeta);
                  return meta ? `${meta.seasonCount} seasons / ${meta.totalEpisodes} episodes tracked from TVMaze` : "";
                })()}
              </p>
            ) : null}
          </div>
        ) : null}

        {activeKind === "Book" ? (
          <>
            <input
              inputMode="numeric"
              placeholder="Page number"
              value={draft.pageNumber}
              onChange={(event) => updateDraft("pageNumber", event.target.value)}
            />
          </>
        ) : null}

        {activeKind === "Article" ? (
          <input
            className="form-field-wide"
            placeholder="Link"
            value={draft.url}
            onChange={(event) => updateDraft("url", event.target.value)}
          />
        ) : null}
      </>
    );
  }

  function renderStatusButtons(item: Entry) {
    if (item.kind === "Article") {
      return (
        <div className="status-group">
          <button
            className={item.status === "To start" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "To start")}
          >
            To start
          </button>
          <button
            className={item.status === "Done" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "Done")}
          >
            Done
          </button>
        </div>
      );
    }

    if (item.kind === "Movie") {
      return (
        <div className="status-group">
          <button
            className={item.status === "To start" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "To start")}
          >
            To start
          </button>
          <button
            className={item.status === "In progress" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "In progress")}
          >
            In progress
          </button>
          <button
            className={item.status === "Done" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "Done")}
          >
            Done
          </button>
        </div>
      );
    }

    if (item.kind === "TV Show" || item.kind === "Anime" || item.kind === "Manga") {
      return (
        <div className="status-group">
          <button
            className={item.status === "To start" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "To start")}
          >
            To start
          </button>
          <button
            className={item.status === "In progress" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "In progress")}
          >
            In progress
          </button>
          <button
            className={item.status === "Done" ? "status-button is-active" : "status-button"}
            type="button"
            onClick={() => handleStatusChange(item, "Done")}
          >
            Done
          </button>
        </div>
      );
    }

    return (
      <div className="status-group">
        <button
          className={item.status === "In progress" ? "status-button is-active" : "status-button"}
          type="button"
          onClick={() => handleStatusChange(item, "In progress")}
        >
          Ongoing
        </button>
        <button
          className={item.status === "Done" ? "status-button is-active" : "status-button"}
          type="button"
          onClick={() => handleStatusChange(item, "Done")}
        >
          Completed
        </button>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-copy">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 className="app-title">Masti Archive</h1>
          <p className="app-subtitle">{page.title}</p>
          <p className="app-description">{page.description}</p>
        </div>

        <div className="app-account">
          <p>{userEmail}</p>
          <button className="text-button" disabled={isSigningOut} type="button" onClick={handleSignOut}>
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="app-toolbar">
        <nav className="tab-nav" aria-label="Library routes">
          {tabs.map((tab) => (
            <Link key={tab.href} className={tab.scope === scope ? "tab-button is-active" : "tab-button"} href={tab.href}>
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="summary-strip">
          <div className="summary-item">
            <strong>{visibleItems.length}</strong>
            <span>{scope === "archive" ? "Archived" : scope === "favorites" ? "Favorite items" : "Active"}</span>
          </div>
          <div className="summary-item">
            <strong>{scope === "favorites" ? archiveCount : favoritesCount}</strong>
            <span>{scope === "favorites" ? "Archived total" : "Favorites total"}</span>
          </div>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="content-grid">
        {scope !== "all" && scope !== "archive" && scope !== "favorites" ? (
          <section className="panel panel--form">
            <div className="panel-head">
              <p className="eyebrow">Add new</p>
              <h2>Quick entry</h2>
            </div>

            <form className="entry-form" onSubmit={handleCreate}>
              {renderFormFields()}
              <div className="form-actions">
                <button className="primary-button" disabled={isSaving || isLoadingShowMeta || !canSave} type="submit">
                  {isSaving ? "Saving..." : isLoadingShowMeta ? "Loading..." : "Save"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section
          className={
            scope === "all" || scope === "archive" ? "panel panel--list panel--list-full" : "panel panel--list"
          }
        >
          {isLoadingEntries ? (
            <article className="empty-state">
              <p className="eyebrow">Loading</p>
              <h2>Pulling your shelves in.</h2>
              <p>One moment.</p>
            </article>
          ) : visibleItems.length > 0 ? (
            <div className="entry-list">
              {visibleItems.map((item) => (
                <article className="entry-card" key={item.id}>
                  <div className="entry-card-head">
                    <div className="entry-card-tags">
                      <p className="entry-kind">{item.kind}</p>
                    </div>
                    <div className="entry-side">
                      <p className="entry-date">Updated {formatDate(item.updatedAt)}</p>
                      <button className={item.favorite ? "text-button text-button--favorite is-active" : "text-button text-button--favorite"} type="button" onClick={() => handleFavoriteToggle(item)}>
                        {item.favorite ? "Favorite" : "Add to favorites"}
                      </button>
                      <button className="text-button text-button--danger" type="button" onClick={() => handleDelete(item)}>
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="entry-card-body">
                    <h3 className="entry-name">{item.title}</h3>
                    {item.kind === "Book" && (item.creator || item.releaseYear) ? (
                      <p className="entry-meta">
                        {item.creator ? item.creator : ""}
                        {item.creator && item.releaseYear ? " / " : ""}
                        {item.releaseYear ? `Published ${item.releaseYear}` : ""}
                      </p>
                    ) : null}
                    {(item.kind === "Movie" || item.kind === "TV Show") &&
                    (item.creator || item.releaseYear || item.imdbRating) ? (
                      <p className="entry-meta">
                        {item.creator ? `${item.kind === "Movie" ? "Director" : "Credits"}: ${item.creator}` : ""}
                        {item.creator && (item.releaseYear || item.imdbRating) ? " / " : ""}
                        {item.releaseYear ? `Released ${item.releaseYear}` : ""}
                        {item.releaseYear && item.imdbRating ? " / " : ""}
                        {item.imdbRating ? `IMDb ${item.imdbRating}` : ""}
                      </p>
                    ) : null}
                    {item.kind === "Anime"
                      ? (() => {
                          const progress = getShowProgress(item.showMeta, item.currentSeason, item.currentEpisode);
                          const pieces = [
                            item.creator ? `Studio: ${item.creator}` : "",
                            item.releaseYear ? `Released ${item.releaseYear}` : "",
                            progress?.totalEpisodes ? `${progress.totalEpisodes} episodes` : "",
                          ].filter(Boolean);

                          return pieces.length > 0 ? <p className="entry-meta">{pieces.join(" / ")}</p> : null;
                        })()
                      : null}
                    {item.kind === "Manga"
                      ? (() => {
                          const progress = getMangaProgress(item.mangaMeta, item.currentChapter);
                          const pieces = [
                            item.creator ? `Author: ${item.creator}` : "",
                            item.releaseYear ? `Published ${item.releaseYear}` : "",
                            progress?.totalChapters ? `${progress.totalChapters} chapters` : "",
                          ].filter(Boolean);

                          return pieces.length > 0 ? <p className="entry-meta">{pieces.join(" / ")}</p> : null;
                        })()
                      : null}
                    {item.kind === "Article" && item.url ? (
                      <a className="entry-link" href={item.url} rel="noreferrer" target="_blank">
                        {getHostname(item.url)}
                      </a>
                    ) : null}
                  </div>

                  <div className="entry-card-bottom">
                    {item.kind === "Book" ? (
                      <label className="inline-field inline-field--card">
                        <span>Page number</span>
                        <input
                          key={`${item.id}-${item.pageNumber}`}
                          defaultValue={item.pageNumber > 0 ? String(item.pageNumber) : ""}
                          inputMode="numeric"
                          placeholder="0"
                          onBlur={(event) => handleBookPageChange(item, event.target.value)}
                        />
                      </label>
                    ) : item.kind === "Anime" ? (
                      <div className="show-progress">
                        <label className="inline-field inline-field--card inline-field--compact">
                          <span>Episode</span>
                          <input
                            key={`${item.id}-anime-episode-${item.currentEpisode}`}
                            defaultValue={item.currentEpisode > 0 ? String(item.currentEpisode) : ""}
                            inputMode="numeric"
                            placeholder="0"
                            onBlur={(event) => handleShowProgressChange(item, { currentSeason: "1", currentEpisode: event.target.value })}
                          />
                        </label>
                        {(() => {
                          const progress = getShowProgress(item.showMeta, 1, item.currentEpisode);

                          return progress ? (
                            <p className="show-progress-copy">
                              {`Episode ${progress.currentEpisode} of ${progress.totalEpisodes} / ${progress.remainingEpisodes} left`}
                            </p>
                          ) : (
                            <p className="show-progress-copy">AniList episode total unavailable.</p>
                          );
                        })()}
                      </div>
                    ) : item.kind === "TV Show" ? (
                      <div className="show-progress">
                        <div className="show-progress-fields">
                          <label className="inline-field inline-field--card inline-field--compact">
                            <span>Season</span>
                            <input
                              key={`${item.id}-season-${item.currentSeason}`}
                              defaultValue={item.currentSeason > 0 ? String(item.currentSeason) : ""}
                              inputMode="numeric"
                              placeholder="1"
                              onBlur={(event) => handleShowProgressChange(item, { currentSeason: event.target.value })}
                            />
                          </label>
                          <label className="inline-field inline-field--card inline-field--compact">
                            <span>Episode</span>
                            <input
                              key={`${item.id}-episode-${item.currentEpisode}`}
                              defaultValue={item.currentEpisode > 0 ? String(item.currentEpisode) : ""}
                              inputMode="numeric"
                              placeholder="0"
                              onBlur={(event) => handleShowProgressChange(item, { currentEpisode: event.target.value })}
                            />
                          </label>
                        </div>
                        {(() => {
                          const progress = getShowProgress(item.showMeta, item.currentSeason, item.currentEpisode);

                          return progress ? (
                            <p className="show-progress-copy">
                              {`Season ${progress.currentSeason} of ${progress.seasonCount} / Episode ${item.currentEpisode} of ${progress.currentSeasonEpisodeCount} / ${progress.remainingEpisodes} left`}
                            </p>
                          ) : (
                            <p className="show-progress-copy">TVMaze episode totals unavailable.</p>
                          );
                        })()}
                      </div>
                    ) : item.kind === "Manga" ? (
                      <div className="show-progress">
                        <label className="inline-field inline-field--card inline-field--compact">
                          <span>Chapter</span>
                          <input
                            key={`${item.id}-manga-chapter-${item.currentChapter}`}
                            defaultValue={item.currentChapter > 0 ? String(item.currentChapter) : ""}
                            inputMode="numeric"
                            placeholder="0"
                            onBlur={(event) => handleMangaChapterChange(item, event.target.value)}
                          />
                        </label>
                        {(() => {
                          const progress = getMangaProgress(item.mangaMeta, item.currentChapter);

                          return progress ? (
                            <p className="show-progress-copy">
                              {progress.totalChapters > 0
                                ? `Chapter ${progress.currentChapter} of ${progress.totalChapters} / ${progress.remainingChapters} left`
                                : `Chapter ${item.currentChapter}`}
                            </p>
                          ) : (
                            <p className="show-progress-copy">AniList chapter total unavailable.</p>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="entry-placeholder" />
                    )}

                    {renderStatusButtons(item)}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <article className="empty-state">
              <p className="eyebrow">No entries</p>
              <h2>{page.emptyTitle}</h2>
              <p>{page.emptyCopy}</p>
            </article>
          )}
        </section>
      </section>
    </main>
  );
}
