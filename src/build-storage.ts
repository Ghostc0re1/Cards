import type { BuildLibrary, BuildState } from "./types";
import { defaultState, mergeState } from "./state-model";
import {
  BUILD_LIBRARY_SCHEMA_VERSION,
  makeBuildRecord,
  normalizeBuildLibrary,
} from "./build-library";

export const STORAGE_KEY = "card-builder-state-v1";
export const LIBRARY_STORAGE_KEY = "card-builder-library-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function currentStorage(): StorageLike | null {
  return typeof globalThis.localStorage === "undefined"
    ? null
    : globalThis.localStorage;
}

export function loadLegacyState(
  storage: StorageLike | null = currentStorage(),
): BuildState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return mergeState(defaultState(), JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveLegacyState(
  buildState: BuildState,
  storage: StorageLike | null = currentStorage(),
): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(buildState));
}

export function loadBuildLibrary(
  storage: StorageLike | null = currentStorage(),
): BuildLibrary {
  try {
    const raw = storage?.getItem(LIBRARY_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeBuildLibrary(JSON.parse(raw));
      if (parsed.builds.length) return parsed;
    }
  } catch {
    // Fall back to the legacy single-build state below.
  }
  const initial = makeBuildRecord(loadLegacyState(storage));
  const library: BuildLibrary = {
    schemaVersion: BUILD_LIBRARY_SCHEMA_VERSION,
    activeBuildId: initial.id,
    builds: [initial],
    deletedBuilds: [],
  };
  storage?.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
  return library;
}

export function saveBuildLibraryToStorage(
  library: BuildLibrary,
  storage: StorageLike | null = currentStorage(),
): BuildLibrary {
  const normalized = normalizeBuildLibrary(library);
  storage?.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
