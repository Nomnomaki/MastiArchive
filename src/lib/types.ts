export const entryKinds = ["Book", "Movie", "TV Show", "Anime", "Manga", "Article"] as const;

export type EntryKind = (typeof entryKinds)[number];
export type EntryStatus = "To start" | "In progress" | "Done";
export type TrackerScope = "all" | EntryKind | "archive" | "favorites";

export function normalizeEntryKind(value: unknown): EntryKind | null {
  if (
    value === "Book" ||
    value === "Movie" ||
    value === "TV Show" ||
    value === "Anime" ||
    value === "Manga" ||
    value === "Article"
  ) {
    return value;
  }

  if (value === "Substack") {
    return "Article";
  }

  return null;
}

export type EntryRecord = {
  id: string;
  userId: string;
  title: string;
  creator: string;
  releaseYear: string;
  imdbRating: string;
  showMeta: string;
  currentSeason: number;
  currentEpisode: number;
  mangaMeta: string;
  currentChapter: number;
  kind: EntryKind;
  status: EntryStatus;
  favorite: boolean;
  pageNumber: number;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type Entry = Omit<EntryRecord, "userId">;

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

export type PublicUser = Pick<UserRecord, "id" | "email" | "createdAt">;

export type Store = {
  users: UserRecord[];
  entries: EntryRecord[];
};
