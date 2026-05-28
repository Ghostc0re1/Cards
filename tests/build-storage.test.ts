import { describe, expect, it } from "vitest";
import {
  LIBRARY_STORAGE_KEY,
  STORAGE_KEY,
  loadBuildLibrary,
  loadLegacyState,
  saveBuildLibraryToStorage,
  saveLegacyState,
} from "../src/build-storage";
import { makeBuildRecord } from "../src/build-library";
import { defaultState } from "../src/state-model";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("build-storage", () => {
  it("falls back to default state when legacy storage is corrupted", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{bad json" });

    expect(loadLegacyState(storage).title).toBe("");
  });

  it("falls back from a corrupted library to the legacy state", () => {
    const storage = memoryStorage({
      [LIBRARY_STORAGE_KEY]: "{bad json",
      [STORAGE_KEY]: JSON.stringify({ ...defaultState(), title: "Legacy" }),
    });

    const library = loadBuildLibrary(storage);

    expect(library.builds).toHaveLength(1);
    expect(library.builds[0].state.title).toBe("Legacy");
    expect(JSON.parse(storage.values.get(LIBRARY_STORAGE_KEY) || "{}")).toEqual(
      expect.objectContaining({ activeBuildId: library.activeBuildId }),
    );
  });

  it("normalizes libraries before saving them", () => {
    const storage = memoryStorage();
    const build = makeBuildRecord({ ...defaultState(), title: "Saved" }, "");
    const normalized = saveBuildLibraryToStorage(
      {
        schemaVersion: 999,
        activeBuildId: "missing",
        builds: [build],
        deletedBuilds: [{ id: "gone", deletedAt: "not-a-date" }],
      },
      storage,
    );

    expect(normalized.schemaVersion).toBe(3);
    expect(normalized.activeBuildId).toBe(build.id);
    expect(normalized.deletedBuilds[0].deletedAt).not.toBe("not-a-date");
    expect(JSON.parse(storage.values.get(LIBRARY_STORAGE_KEY) || "{}")).toEqual(
      normalized,
    );
  });

  it("safely no-ops when localStorage is unavailable", () => {
    const state = { ...defaultState(), title: "No Storage" };

    expect(() => saveLegacyState(state, null)).not.toThrow();
    expect(loadLegacyState(null).title).toBe("");
    expect(loadBuildLibrary(null).builds).toHaveLength(1);
    expect(() =>
      saveBuildLibraryToStorage(
        {
          schemaVersion: 3,
          activeBuildId: "",
          builds: [],
          deletedBuilds: [],
        },
        null,
      ),
    ).not.toThrow();
  });
});
