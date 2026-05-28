import { describe, expect, it } from "vitest";
import {
  defaultState,
  equipmentForSet,
  equipmentSetLabel,
  mergeState,
} from "../src/state-model";

describe("state-model", () => {
  it("creates the default blank build shape", () => {
    const state = defaultState();

    expect(state.theme).toBe("linear");
    expect(state.title).toBe("");
    expect(state.mainSkills).toHaveLength(5);
    expect(state.situationalSkills).toHaveLength(4);
    expect(state.equipmentSet).toBe("");
    expect(state.equipment.map((slot) => slot.assetId)).toEqual(["", "", "", ""]);
    expect(state.upgrades[1]).toMatchObject({
      title: "2. USABLE & VIABLE?",
      usable: "",
      viable: "",
      body: "",
    });
  });

  it("applies equipment presets and infers exact legacy hybrid gear", () => {
    expect(equipmentSetLabel("defense")).toBe("Eternal Daylight Set");
    expect(equipmentForSet("attack").map((slot) => slot.assetId)).toEqual([
      "equipment-atk-sword",
      "equipment-atk-chest",
      "equipment-atk-ring",
      "equipment-atk-boots",
    ]);

    const migrated = mergeState(defaultState(), {
      equipment: [
        { assetId: "gear-4" },
        { assetId: "gear-2" },
        { assetId: "gear-5" },
        { assetId: "gear-3" },
      ],
    });

    expect(migrated.equipmentSet).toBe("hybrid");
    expect(migrated.equipment.map((slot) => slot.assetId)).toEqual([
      "equipment-atk-sword",
      "equipment-def-chest",
      "equipment-atk-ring",
      "equipment-def-boots",
    ]);
  });

  it("splits legacy Upgrade 2 body text into usable, viable, and note", () => {
    const state = mergeState(defaultState(), {
      upgrades: [
        { title: "1. PROGRESSION", body: "" },
        {
          title: "2. USABLE & VIABLE?",
          body: "▸ Usable: 10 ⭐\nViable: 11 ⭐ a5\n†Usability and Viability are based on elo.",
        },
      ],
    });

    expect(state.upgrades[1].usable).toBe("10 ⭐");
    expect(state.upgrades[1].viable).toBe("11 ⭐ a5");
    expect(state.upgrades[1].body).toBe(
      "Usability and Viability are based on elo.",
    );
  });

  it("normalizes malformed theme, colors, and tags", () => {
    const state = mergeState(defaultState(), {
      theme: "sunset",
      tags: "Alpha • Beta, Gamma|Delta|Extra",
      colors: {
        title: "hotpink",
        tags: "#123abc",
        body: "#fff",
        banner: "#ABCDEF",
        marker: 12,
      },
    });

    expect(state.theme).toBe("linear");
    expect(state.tags).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(state.colors).toEqual({
      title: "",
      tags: "#123abc",
      body: "",
      banner: "#ABCDEF",
      marker: "",
    });
  });
});
