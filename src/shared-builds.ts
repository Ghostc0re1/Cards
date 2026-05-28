import { defaultState, mergeState } from "./state-model";
import type {
  BuildRecord,
  BuildShareRow,
  ProfileRow,
  SharedBuild,
  SharedBuildGroup,
  SharedBuildRow,
  UserProfile,
} from "./types";

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeUsername(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function usernameValidationMessage(value: unknown): string {
  const username = normalizeUsername(value);
  if (!username) return "Choose a username.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 24) return "Username must be 24 characters or fewer.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Use only letters, numbers, and underscores.";
  }
  return "";
}

export function profileRowToProfile(row: ProfileRow | null | undefined): UserProfile | null {
  if (!row?.user_id || !row.username_key) return null;
  return {
    userId: row.user_id,
    username: row.username || row.username_key,
    usernameKey: row.username_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function profileToRow(profile: {
  userId: string;
  username: string;
}): ProfileRow {
  const usernameKey = normalizeUsername(profile.username);
  const now = new Date().toISOString();
  return {
    user_id: profile.userId,
    username: usernameKey,
    username_key: usernameKey,
    created_at: now,
    updated_at: now,
  };
}

export function sharedBuildRowToBuild(row: SharedBuildRow): SharedBuild {
  const normalizedState = mergeState(defaultState(), row.state_json || {});
  const heroName =
    String(row.hero_name || normalizedState.title || "Untitled hero").trim() ||
    "Untitled hero";
  return {
    id: row.id,
    ownerId: row.owner_id,
    username: row.username,
    heroName,
    name: row.name || heroName,
    state: normalizedState,
    updatedAt: row.updated_at,
    sharedAt: row.shared_at,
  };
}

export function buildRecordToShareRow(
  build: BuildRecord,
  ownerId: string,
  sharedAt: string,
): BuildShareRow {
  return {
    id: build.id,
    owner_id: ownerId,
    name: build.name,
    state_json: mergeState(defaultState(), build.state || {}),
    updated_at: sharedAt,
    shared_at: sharedAt,
  };
}

export function normalizeSharedBuildRows(rows: unknown): SharedBuild[] {
  const items = Array.isArray(rows) ? rows : [];
  return items
    .map((item) => {
      const source = objectRecord(item);
      return sharedBuildRowToBuild({
        id: String(source.id || ""),
        owner_id: String(source.owner_id || ""),
        username: String(source.username || "unknown"),
        hero_name:
          source.hero_name === null || source.hero_name === undefined
            ? null
            : String(source.hero_name),
        name: String(source.name || ""),
        state_json: mergeState(defaultState(), source.state_json || {}),
        updated_at: String(source.updated_at || ""),
        shared_at: String(source.shared_at || ""),
      });
    })
    .filter((build) => build.id && build.ownerId && build.sharedAt);
}

export function groupSharedBuilds(builds: SharedBuild[]): SharedBuildGroup[] {
  const groups = new Map<string, SharedBuild[]>();
  for (const build of [...builds].sort(
    (first, second) =>
      Date.parse(second.sharedAt || "") - Date.parse(first.sharedAt || ""),
  )) {
    const key = build.heroName || "Untitled hero";
    groups.set(key, [...(groups.get(key) || []), build]);
  }
  return Array.from(groups.entries())
    .map(([heroName, groupedBuilds]) => ({ heroName, builds: groupedBuilds }))
    .sort((first, second) => first.heroName.localeCompare(second.heroName));
}

export function isDuplicateUsernameError(error: unknown): boolean {
  const source = objectRecord(error);
  const message = String(source.message || "").toLowerCase();
  return (
    String(source.code || "") === "23505" ||
    message.includes("duplicate") ||
    message.includes("unique")
  );
}
