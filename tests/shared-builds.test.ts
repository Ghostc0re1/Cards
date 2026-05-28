import { describe, expect, it } from "vitest";
import {
  buildRecordToShareRow,
  groupSharedBuilds,
  normalizeSharedBuildRows,
  normalizeUsername,
  profileRowToProfile,
  profileToRow,
  usernameValidationMessage,
} from "../src/shared-builds";
import { makeBuildRecord } from "../src/build-library";
import { defaultState } from "../src/state-model";

describe("shared-builds", () => {
  it("normalizes and validates usernames", () => {
    expect(normalizeUsername(" Builder_01 ")).toBe("builder_01");
    expect(usernameValidationMessage("ab")).toBe(
      "Username must be at least 3 characters.",
    );
    expect(usernameValidationMessage("bad-name")).toBe(
      "Use only letters, numbers, and underscores.",
    );
    expect(usernameValidationMessage("valid_name")).toBe("");
  });

  it("converts profile rows without exposing email", () => {
    const row = profileToRow({ userId: "user-1", username: "Builder" });

    expect(row).toMatchObject({
      user_id: "user-1",
      username: "builder",
      username_key: "builder",
    });
    expect(profileRowToProfile(row)).toMatchObject({
      userId: "user-1",
      username: "builder",
      usernameKey: "builder",
    });
    expect(profileRowToProfile(null)).toBeNull();
  });

  it("normalizes shared build rows and groups by hero", () => {
    const wendy = { ...defaultState(), title: "Wendy" };
    const rows = [
      {
        id: "old",
        owner_id: "user-1",
        username: "builder",
        hero_name: "Wendy",
        name: "Old Wendy",
        state_json: wendy,
        updated_at: "2026-01-01T00:00:00.000Z",
        shared_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "new",
        owner_id: "user-2",
        username: "other",
        hero_name: "",
        name: "Blank Hero",
        state_json: defaultState(),
        updated_at: "2026-01-02T00:00:00.000Z",
        shared_at: "2026-01-03T00:00:00.000Z",
      },
    ];

    const builds = normalizeSharedBuildRows(rows);
    const groups = groupSharedBuilds(builds);

    expect(builds[0]).toMatchObject({ heroName: "Wendy", username: "builder" });
    expect(groups.map((group) => group.heroName)).toEqual([
      "Untitled hero",
      "Wendy",
    ]);
    expect(groups[0].builds[0].id).toBe("new");
  });

  it("creates published snapshot rows from build records", () => {
    const state = { ...defaultState(), title: "Wendy" };
    const build = makeBuildRecord(state, "Public Wendy");
    const sharedAt = "2026-01-04T00:00:00.000Z";

    expect(buildRecordToShareRow(build, "user-1", sharedAt)).toMatchObject({
      id: build.id,
      owner_id: "user-1",
      name: "Public Wendy",
      state_json: { title: "Wendy" },
      updated_at: sharedAt,
      shared_at: sharedAt,
    });
  });
});
