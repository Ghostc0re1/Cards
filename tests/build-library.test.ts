import { describe, expect, it } from "vitest";
import {
  buildRecordToCloudRow,
  importedBuildsFromPayload,
  makeBuildRecord,
  mergeBuildLibraries,
  tombstoneToCloudRow,
} from "../src/build-library";
import { defaultState } from "../src/state-model";
import type { BuildLibrary, BuildRecord, CloudBuildRow } from "../src/types";

const older = "2026-01-01T00:00:00.000Z";
const middle = "2026-01-02T00:00:00.000Z";
const newer = "2026-01-03T00:00:00.000Z";

function record(id: string, updatedAt: string, title = "Wendy"): BuildRecord {
  return {
    ...makeBuildRecord({ ...defaultState(), title }, title),
    id,
    createdAt: older,
    updatedAt,
  };
}

function library(builds: BuildRecord[]): BuildLibrary {
  return {
    schemaVersion: 3,
    activeBuildId: builds[0]?.id || "",
    builds,
    deletedBuilds: [],
  };
}

function row(build: BuildRecord, deletedAt: string | null = null): CloudBuildRow {
  return {
    ...buildRecordToCloudRow(build, "user-1"),
    deleted_at: deletedAt,
  };
}

describe("build-library", () => {
  it("validates imported build payloads", () => {
    expect(() => importedBuildsFromPayload({ builds: "bad" })).toThrow(
      "Build JSON builds must be an array.",
    );

    const imported = importedBuildsFromPayload({
      title: "Solo",
      tags: ["Magic"],
    });

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe("Solo");
    expect(imported[0].state.title).toBe("Solo");
  });

  it("lets tombstones win over older builds", () => {
    const build = record("build-1", older);
    const merged = mergeBuildLibraries(library([build]), [
      row(build, middle),
    ]);

    expect(merged.builds.find((item) => item.id === "build-1")).toBeUndefined();
    expect(merged.deletedBuilds).toEqual([
      { id: "build-1", deletedAt: middle },
    ]);
  });

  it("lets newer builds win over older tombstones", () => {
    const build = record("build-1", newer, "Recovered");
    const merged = mergeBuildLibraries(
      {
        ...library([]),
        deletedBuilds: [{ id: "build-1", deletedAt: middle }],
      },
      [row(build)],
    );

    expect(merged.builds[0].id).toBe("build-1");
    expect(merged.builds[0].state.title).toBe("Recovered");
    expect(merged.deletedBuilds).toEqual([]);
  });

  it("converts cloud tombstone rows without losing deleted_at", () => {
    const tombstone = { id: "build-deleted", deletedAt: newer };
    const cloudRow = tombstoneToCloudRow(tombstone, "user-1");

    expect(cloudRow.owner_id).toBe("user-1");
    expect(cloudRow.deleted_at).toBe(newer);
    expect(cloudRow.shared_at).toBeNull();
    expect(cloudRow.updated_at).toBe(newer);
    expect(cloudRow.state_json).toMatchObject(defaultState());
  });

  it("normalizes v2 builds with private sharing defaults and preserves shared_at", () => {
    const build = record("build-shared", newer, "Shared Wendy");
    build.sharedAt = middle;
    const cloudRow = buildRecordToCloudRow(build, "user-1");

    expect(cloudRow.shared_at).toBe(middle);
    expect(importedBuildsFromPayload({ builds: [{ ...build, sharedAt: undefined }] })[0].sharedAt).toBeNull();
  });

  it("creates an untitled fallback when no builds survive", () => {
    const merged = mergeBuildLibraries(library([]), []);

    expect(merged.builds).toHaveLength(1);
    expect(merged.builds[0].name).toBe("Untitled build");
    expect(merged.activeBuildId).toBe(merged.builds[0].id);
  });
});
