import type {
  BuildLibrary,
  BuildRecord,
  BuildState,
  BuildTombstone,
  CloudBuildRow,
} from "./types";
import {
  buildNameFromState,
  createBuildId,
  defaultState,
  mergeState,
} from "./state-model";

export const BUILD_LIBRARY_SCHEMA_VERSION = 3;
export const MAX_IMPORT_JSON_BYTES = 2 * 1024 * 1024;

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function parseTime(value: unknown): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableTime(value: unknown): string | null {
  return parseTime(value) ? String(value) : null;
}

export function makeBuildRecord(
  buildState: unknown,
  name = "",
): BuildRecord {
  const now = new Date().toISOString();
  const normalized = mergeState(defaultState(), buildState || {});
  return {
    id: createBuildId(),
    name:
      String(name || buildNameFromState(normalized)).trim() || "Untitled build",
    createdAt: now,
    updatedAt: now,
    sharedAt: null,
    state: normalized,
  };
}

export function normalizeBuildRecord(record: unknown): BuildRecord {
  const source = objectRecord(record);
  const normalizedState = mergeState(defaultState(), source.state || {});
  return {
    id: String(source.id || createBuildId()),
    name:
      String(source.name || buildNameFromState(normalizedState)).trim() ||
      "Untitled build",
    createdAt: String(source.createdAt || new Date().toISOString()),
    updatedAt: String(source.updatedAt || new Date().toISOString()),
    sharedAt: nullableTime(source.sharedAt || source.shared_at),
    state: normalizedState,
  };
}

export function normalizeTombstone(record: unknown): BuildTombstone | null {
  const source = objectRecord(record);
  if (!source.id) return null;
  const candidate = source.deletedAt || source.deleted_at;
  const deletedAt = parseTime(candidate) ? String(candidate) : new Date().toISOString();
  return {
    id: String(source.id),
    deletedAt,
  };
}

export function mergeTombstones(
  ...groups: Array<unknown[] | undefined>
): BuildTombstone[] {
  const tombstones = new Map<string, BuildTombstone>();
  for (const group of groups) {
    for (const item of group || []) {
      const tombstone = normalizeTombstone(item);
      if (!tombstone) continue;
      const existing = tombstones.get(tombstone.id);
      if (!existing || parseTime(tombstone.deletedAt) > parseTime(existing.deletedAt)) {
        tombstones.set(tombstone.id, tombstone);
      }
    }
  }
  return Array.from(tombstones.values()).sort(
    (first, second) => parseTime(second.deletedAt) - parseTime(first.deletedAt),
  );
}

export function normalizeBuildLibrary(library: unknown): BuildLibrary {
  const source = objectRecord(library);
  const builds = Array.isArray(source.builds)
    ? source.builds.map(normalizeBuildRecord)
    : [];
  const deletedBuilds = mergeTombstones(
    Array.isArray(source.deletedBuilds) ? source.deletedBuilds : undefined,
  );
  const survivingBuilds = builds.filter((build) => {
    const tombstone = deletedBuilds.find((item) => item.id === build.id);
    return !tombstone || parseTime(build.updatedAt) > parseTime(tombstone.deletedAt);
  });
  const activeBuildId = survivingBuilds.some(
    (build) => build.id === source.activeBuildId,
  )
    ? String(source.activeBuildId)
    : survivingBuilds[0]?.id || "";
  return {
    schemaVersion: BUILD_LIBRARY_SCHEMA_VERSION,
    activeBuildId,
    builds: survivingBuilds,
    deletedBuilds,
  };
}

export function cloudBuildRowToRecord(row: CloudBuildRow): BuildRecord {
  return normalizeBuildRecord({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sharedAt: row.shared_at,
    state: row.state_json,
  });
}

export function cloudBuildRowToTombstone(row: CloudBuildRow): BuildTombstone | null {
  return normalizeTombstone({
    id: row.id,
    deletedAt: row.deleted_at || row.updated_at,
  });
}

export function buildRecordToCloudRow(
  build: BuildRecord,
  ownerId: string,
): CloudBuildRow {
  return {
    id: build.id,
    owner_id: ownerId,
    name: build.name,
    state_json: build.state,
    created_at: build.createdAt,
    updated_at: build.updatedAt,
    deleted_at: null,
    shared_at: build.sharedAt,
  };
}

export function tombstoneToCloudRow(
  tombstone: BuildTombstone,
  ownerId: string,
): CloudBuildRow {
  return {
    id: tombstone.id,
    owner_id: ownerId,
    name: "Deleted build",
    state_json: defaultState(),
    created_at: tombstone.deletedAt,
    updated_at: tombstone.deletedAt,
    deleted_at: tombstone.deletedAt,
    shared_at: null,
  };
}

export function mergeBuildLibraries(
  localLibrary: unknown,
  cloudRows: CloudBuildRow[],
): BuildLibrary {
  const merged = new Map<string, BuildRecord>();
  const local = normalizeBuildLibrary(localLibrary);
  let deletedBuilds = mergeTombstones(local.deletedBuilds);
  for (const build of local.builds.map(normalizeBuildRecord)) {
    merged.set(build.id, build);
  }
  for (const row of cloudRows) {
    if (row.deleted_at) {
      const tombstone = cloudBuildRowToTombstone(row);
      deletedBuilds = mergeTombstones(
        deletedBuilds,
        tombstone ? [tombstone] : undefined,
      );
      continue;
    }
    const cloudBuild = cloudBuildRowToRecord(row);
    const localBuild = merged.get(cloudBuild.id);
    if (!localBuild || parseTime(cloudBuild.updatedAt) > parseTime(localBuild.updatedAt)) {
      merged.set(cloudBuild.id, cloudBuild);
    }
  }
  const survivingBuilds: BuildRecord[] = [];
  const survivingTombstones: BuildTombstone[] = [];
  for (const tombstone of deletedBuilds) {
    const build = merged.get(tombstone.id);
    if (build && parseTime(build.updatedAt) > parseTime(tombstone.deletedAt)) {
      continue;
    }
    if (build) merged.delete(tombstone.id);
    survivingTombstones.push(tombstone);
  }
  for (const build of merged.values()) survivingBuilds.push(build);
  let builds = survivingBuilds.sort(
    (first, second) => parseTime(second.updatedAt) - parseTime(first.updatedAt),
  );
  if (!builds.length) {
    builds = [makeBuildRecord(defaultState(), "Untitled build")];
  }
  const activeBuildId = builds.some((build) => build.id === local.activeBuildId)
    ? local.activeBuildId
    : builds[0]?.id || "";
  return {
    schemaVersion: BUILD_LIBRARY_SCHEMA_VERSION,
    activeBuildId,
    builds,
    deletedBuilds: survivingTombstones,
  };
}

export function importedBuildsFromPayload(payload: unknown): BuildRecord[] {
  const source = objectRecord(payload);
  if (!payload || typeof payload !== "object") {
    throw new Error("Build JSON must contain an object.");
  }
  if (Object.hasOwn(source, "builds") && !Array.isArray(source.builds)) {
    throw new Error("Build JSON builds must be an array.");
  }
  const incomingBuilds = Array.isArray(source.builds) ? source.builds : [source];
  if (!incomingBuilds.length) {
    throw new Error("Build JSON does not contain any builds.");
  }
  if (incomingBuilds.length > 100) {
    throw new Error("Build JSON contains too many builds.");
  }
  return incomingBuilds.map((build) => {
    const buildSource = objectRecord(build);
    if (!build || typeof build !== "object") {
      throw new Error("Each imported build must be an object.");
    }
    const stateCandidate = buildSource.state || buildSource.state_json || buildSource;
    if (!stateCandidate || typeof stateCandidate !== "object") {
      throw new Error("Each imported build must contain build state.");
    }
    return normalizeBuildRecord({
      ...buildSource,
      id: buildSource.id || createBuildId(),
      name: buildSource.name || buildNameFromState(stateCandidate),
      state: stateCandidate,
    });
  });
}

export function buildLibraryFromImportedPayload(
  currentLibrary: BuildLibrary,
  payload: unknown,
): { library: BuildLibrary; importedBuilds: BuildRecord[] } {
  const source = objectRecord(payload);
  const normalizedBuilds = importedBuildsFromPayload(payload);
  const byId = new Map(currentLibrary.builds.map((build) => [build.id, build]));
  for (const build of normalizedBuilds) byId.set(build.id, build);
  const builds = Array.from(byId.values()).sort(
    (first, second) => parseTime(second.updatedAt) - parseTime(first.updatedAt),
  );
  const deletedBuilds = mergeTombstones(
    currentLibrary.deletedBuilds,
    Array.isArray(source.deletedBuilds) ? source.deletedBuilds : undefined,
  );
  return {
    library: normalizeBuildLibrary({
      ...currentLibrary,
      builds,
      deletedBuilds,
      activeBuildId: normalizedBuilds[0]?.id || currentLibrary.activeBuildId,
    }),
    importedBuilds: normalizedBuilds,
  };
}

export type { BuildLibrary, BuildRecord, BuildState, BuildTombstone, CloudBuildRow };
