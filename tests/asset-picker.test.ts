import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pickerItems,
  renderAssetPicker,
  skillLabelPathForAssetPath,
} from "../src/asset-picker";

describe("asset-picker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps picked skill asset paths to their label fields", () => {
    expect(skillLabelPathForAssetPath("mainSkills.0.assetId")).toBe(
      "mainSkills.0.label",
    );
    expect(skillLabelPathForAssetPath("situationalSkills.2.assetId")).toBe(
      "situationalSkills.2.label",
    );
    expect(skillLabelPathForAssetPath("skillRows.4.assetId")).toBe(
      "skillRows.4.title",
    );
  });

  it("does not auto-label non-skill asset paths", () => {
    expect(skillLabelPathForAssetPath("devices.0.assetId")).toBe("");
    expect(skillLabelPathForAssetPath("mainSkills.0.label")).toBe("");
  });

  it("returns picker catalog items by kind", () => {
    expect(pickerItems("skill")[0]).toEqual(
      expect.objectContaining({ kind: "skill" }),
    );
    expect(pickerItems("device")[0]).toEqual(
      expect.objectContaining({ kind: "device" }),
    );
    expect(pickerItems("gear")[0]).toEqual(
      expect.objectContaining({ kind: "gear" }),
    );
  });

  it("renders picker buttons and returns active picker state", () => {
    const appended: unknown[] = [];
    const createdCanvases: Array<{ width: number; height: number }> = [];
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        const element = {
          tagName,
          type: "",
          className: "",
          dataset: {} as Record<string, string>,
          textContent: "",
          width: 0,
          height: 0,
          append: (...children: unknown[]) => {
            (element as { children?: unknown[] }).children = children;
          },
          getContext: () => ({ clearRect: () => {} }),
        };
        if (tagName === "canvas") createdCanvases.push(element);
        return element;
      },
    });
    const grid = {
      innerHTML: "old",
      append: (item: unknown) => appended.push(item),
    } as unknown as HTMLElement;
    const title = { textContent: "" } as HTMLElement;

    const state = renderAssetPicker({
      kind: "device",
      path: "devices.0.assetId",
      grid,
      title,
      images: {},
    });

    expect(state).toEqual({ kind: "device", path: "devices.0.assetId" });
    expect(title.textContent).toBe("Choose device");
    expect(grid.innerHTML).toBe("");
    expect(appended).toHaveLength(pickerItems("device").length);
    expect(createdCanvases[0]).toMatchObject({ width: 92, height: 124 });
  });
});
