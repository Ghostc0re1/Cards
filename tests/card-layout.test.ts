import { describe, expect, it } from "vitest";
import {
  inRect,
  interactiveRegions,
  sectionKeyForPath,
  sourcePointFromClientPoint,
} from "../src/card-layout";

describe("card-layout", () => {
  it("maps key canvas regions to field and picker paths", () => {
    const regions = interactiveRegions();

    expect(regions).toContainEqual(
      expect.objectContaining({
        type: "field",
        path: "equipmentSet",
        rect: { x: 112, y: 492, w: 348, h: 238 },
      }),
    );
    expect(regions).toContainEqual(
      expect.objectContaining({ type: "field", path: "title" }),
    );
    expect(regions).toContainEqual(
      expect.objectContaining({ type: "field", path: "notes" }),
    );
    expect(regions).toContainEqual(
      expect.objectContaining({
        type: "picker",
        kind: "skill",
        path: "mainSkills.0.assetId",
      }),
    );
  });

  it("maps split Upgrade 2 regions to the right fields", () => {
    const paths = interactiveRegions().map((region) => region.path);

    expect(paths).toContain("upgrades.1.title");
    expect(paths).toContain("upgrades.1.usable");
    expect(paths).toContain("upgrades.1.viable");
    expect(paths).toContain("upgrades.1.body");
  });

  it("detects points inside and outside source-space rectangles", () => {
    const rect = { x: 10, y: 20, w: 30, h: 40 };

    expect(inRect({ x: 10, y: 20 }, rect)).toBe(true);
    expect(inRect({ x: 40, y: 60 }, rect)).toBe(true);
    expect(inRect({ x: 41, y: 60 }, rect)).toBe(false);
  });

  it("maps browser coordinates into source canvas coordinates", () => {
    expect(
      sourcePointFromClientPoint(
        { clientX: 150, clientY: 250 },
        { left: 100, top: 200, width: 500, height: 1000 },
        { width: 1000, height: 2000 },
      ),
    ).toEqual({ x: 100, y: 100 });
  });

  it("maps editor paths to sidebar sections", () => {
    expect(sectionKeyForPath("mainSkills.0.assetId")).toBe("main-skills");
    expect(sectionKeyForPath("situationalSkills.0.assetId")).toBe(
      "situational-skills",
    );
    expect(sectionKeyForPath("equipmentSet")).toBe("equipment");
    expect(sectionKeyForPath("equipment.0.assetId")).toBe("equipment");
    expect(sectionKeyForPath("devices.0.assetId")).toBe("magic-devices");
    expect(sectionKeyForPath("skillRows.0.body")).toBe(
      "skills-i-use-and-why",
    );
    expect(sectionKeyForPath("upgrades.1.usable")).toBe("how-i-upgraded");
    expect(sectionKeyForPath("title")).toBe("character-and-notes");
    expect(sectionKeyForPath("tags.0")).toBe("character-and-notes");
    expect(sectionKeyForPath("headers.guide")).toBe("section-text");
    expect(sectionKeyForPath("rank")).toBe("section-text");
    expect(sectionKeyForPath("colors.title")).toBe("font-colors");
    expect(sectionKeyForPath("")).toBe("");
    expect(sectionKeyForPath("unknown.path")).toBe("");
  });
});
