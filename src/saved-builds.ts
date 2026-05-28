import type { BuildLibrary, BuildRecord } from "./types";

export type SavedBuildSort = "updated" | "name" | "hero" | "published";
export type SavedBuildFilter = "all" | "published" | "private" | "local";

export interface SavedBuildListOptions {
  query?: string;
  sort?: SavedBuildSort;
  filter?: SavedBuildFilter;
  activeBuildId?: string;
  profileUsername?: string;
}

export interface SavedBuildListItem {
  id: string;
  name: string;
  heroName: string;
  tags: string[];
  tagSummary: string;
  notes: string;
  updatedAt: string;
  updatedLabel: string;
  sharedAt: string | null;
  statusLabel: string;
  searchText: string;
  isActive: boolean;
  isPublished: boolean;
  hasLocalChanges: boolean;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function searchable(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function parseTime(value: string | null | undefined): number {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareText(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function formatDateLabel(value: string): string {
  if (!parseTime(value)) return "Unknown date";
  return value.slice(0, 10);
}

function buildStatusLabel(build: BuildRecord): string {
  if (!build.sharedAt) return "Private";
  return parseTime(build.updatedAt) > parseTime(build.sharedAt)
    ? "Needs publish"
    : "Published";
}

export function savedBuildToListItem(
  build: BuildRecord,
  options: Pick<SavedBuildListOptions, "activeBuildId" | "profileUsername"> = {},
): SavedBuildListItem {
  const name = normalizeText(build.name) || "Untitled build";
  const heroName = normalizeText(build.state?.title) || "Untitled hero";
  const tags = (build.state?.tags || [])
    .map((tag) => normalizeText(tag))
    .filter(Boolean);
  const tagSummary = tags.length ? tags.join(", ") : "No tags";
  const notes = normalizeText(build.state?.notes);
  const statusLabel = buildStatusLabel(build);
  const profileUsername = normalizeText(options.profileUsername);
  const searchText = [
    name,
    heroName,
    tagSummary,
    notes,
    statusLabel,
    build.sharedAt && profileUsername ? `@${profileUsername}` : "",
  ]
    .map(searchable)
    .filter(Boolean)
    .join(" ");

  return {
    id: build.id,
    name,
    heroName,
    tags,
    tagSummary,
    notes,
    updatedAt: build.updatedAt,
    updatedLabel: formatDateLabel(build.updatedAt),
    sharedAt: build.sharedAt,
    statusLabel,
    searchText,
    isActive: build.id === options.activeBuildId,
    isPublished: Boolean(build.sharedAt),
    hasLocalChanges:
      Boolean(build.sharedAt) && parseTime(build.updatedAt) > parseTime(build.sharedAt),
  };
}

export function buildSavedBuildItems(
  library: BuildLibrary,
  options: SavedBuildListOptions = {},
): SavedBuildListItem[] {
  return library.builds.map((build) =>
    savedBuildToListItem(build, {
      activeBuildId: options.activeBuildId || library.activeBuildId,
      profileUsername: options.profileUsername,
    }),
  );
}

function matchesFilter(
  item: SavedBuildListItem,
  filter: SavedBuildFilter,
): boolean {
  if (filter === "published") return item.isPublished;
  if (filter === "private") return !item.isPublished;
  if (filter === "local") return item.hasLocalChanges;
  return true;
}

function matchesQuery(item: SavedBuildListItem, query: string): boolean {
  const terms = searchable(query).split(/\s+/).filter(Boolean);
  return terms.every((term) => item.searchText.includes(term));
}

export function filterAndSortSavedBuilds(
  items: SavedBuildListItem[],
  options: SavedBuildListOptions = {},
): SavedBuildListItem[] {
  const filter = options.filter || "all";
  const sort = options.sort || "updated";
  const filtered = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesFilter(item, filter))
    .filter(({ item }) => matchesQuery(item, options.query || ""));

  filtered.sort((first, second) => {
    const firstItem = first.item;
    const secondItem = second.item;
    let result = 0;
    if (sort === "name") {
      result =
        compareText(firstItem.name, secondItem.name) ||
        compareText(firstItem.heroName, secondItem.heroName);
    } else if (sort === "hero") {
      result =
        compareText(firstItem.heroName, secondItem.heroName) ||
        compareText(firstItem.name, secondItem.name);
    } else if (sort === "published") {
      result =
        Number(secondItem.isPublished) - Number(firstItem.isPublished) ||
        Number(secondItem.hasLocalChanges) - Number(firstItem.hasLocalChanges) ||
        parseTime(secondItem.sharedAt) - parseTime(firstItem.sharedAt);
    } else {
      result = parseTime(secondItem.updatedAt) - parseTime(firstItem.updatedAt);
    }
    return result || first.index - second.index;
  });

  return filtered.map(({ item }) => item);
}

export function savedBuildFilterLabel(filter: SavedBuildFilter): string {
  if (filter === "published") return "Published";
  if (filter === "private") return "Private";
  if (filter === "local") return "Needs publish";
  return "All";
}
