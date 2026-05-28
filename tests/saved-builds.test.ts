import { describe, expect, it } from "vitest";
import { makeBuildRecord } from "../src/build-library";
import {
  buildSavedBuildItems,
  filterAndSortSavedBuilds,
  savedBuildToListItem,
} from "../src/saved-builds";
import { defaultState } from "../src/state-model";
import type { BuildLibrary, BuildRecord } from "../src/types";

const early = "2026-01-01T00:00:00.000Z";
const middle = "2026-01-02T00:00:00.000Z";
const late = "2026-01-03T00:00:00.000Z";

function buildRecord(
  name: string,
  title: string,
  updatedAt: string,
  overrides: Partial<BuildRecord> = {},
): BuildRecord {
  const state = defaultState();
  state.title = title;
  state.tags = ["Control", "A5"];
  state.notes = "Needs frost timing.";
  return {
    ...makeBuildRecord(state, name),
    updatedAt,
    ...overrides,
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

describe("saved-builds", () => {
  it("searches build name, hero, tags, notes, and status text", () => {
    const published = buildRecord("Arena Control", "Wendy", late, {
      sharedAt: late,
    });
    const privateBuild = buildRecord("Boss Build", "Merlin", early, {
      sharedAt: null,
    });
    const items = buildSavedBuildItems(library([published, privateBuild]), {
      profileUsername: "builder",
    });

    expect(filterAndSortSavedBuilds(items, { query: "arena" })).toHaveLength(1);
    expect(filterAndSortSavedBuilds(items, { query: "wendy" })).toHaveLength(1);
    expect(filterAndSortSavedBuilds(items, { query: "control" })).toHaveLength(2);
    expect(filterAndSortSavedBuilds(items, { query: "frost" })).toHaveLength(2);
    expect(filterAndSortSavedBuilds(items, { query: "published" })).toHaveLength(1);
    expect(filterAndSortSavedBuilds(items, { query: "@builder" })).toHaveLength(1);
  });

  it("sorts by updated date, name, hero, and published status", () => {
    const zeta = buildRecord("Zeta", "Beta", early);
    const alpha = buildRecord("Alpha", "Gamma", late, { sharedAt: middle });
    const beta = buildRecord("Beta", "Alpha", middle);
    const items = buildSavedBuildItems(library([zeta, alpha, beta]));

    expect(filterAndSortSavedBuilds(items, { sort: "updated" }).map((item) => item.name)).toEqual([
      "Alpha",
      "Beta",
      "Zeta",
    ]);
    expect(filterAndSortSavedBuilds(items, { sort: "name" }).map((item) => item.name)).toEqual([
      "Alpha",
      "Beta",
      "Zeta",
    ]);
    expect(filterAndSortSavedBuilds(items, { sort: "hero" }).map((item) => item.heroName)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(filterAndSortSavedBuilds(items, { sort: "published" })[0].name).toBe("Alpha");
  });

  it("filters published, private, and locally changed published builds", () => {
    const published = buildRecord("Published", "Wendy", middle, {
      sharedAt: middle,
    });
    const privateBuild = buildRecord("Private", "Merlin", early);
    const needsPublish = buildRecord("Needs Publish", "Gwen", late, {
      sharedAt: early,
    });
    const items = buildSavedBuildItems(
      library([published, privateBuild, needsPublish]),
    );

    expect(filterAndSortSavedBuilds(items, { filter: "published" }).map((item) => item.name)).toEqual([
      "Needs Publish",
      "Published",
    ]);
    expect(filterAndSortSavedBuilds(items, { filter: "private" }).map((item) => item.name)).toEqual([
      "Private",
    ]);
    expect(filterAndSortSavedBuilds(items, { filter: "local" }).map((item) => item.name)).toEqual([
      "Needs Publish",
    ]);
  });

  it("normalizes blank build metadata to friendly labels", () => {
    const state = defaultState();
    state.title = "";
    state.tags = [];
    state.notes = "";
    const build = {
      ...makeBuildRecord(state, ""),
      updatedAt: "",
    };

    expect(savedBuildToListItem(build)).toMatchObject({
      name: "Untitled build",
      heroName: "Untitled hero",
      tagSummary: "No tags",
      updatedLabel: "Unknown date",
      statusLabel: "Private",
    });
  });
});
