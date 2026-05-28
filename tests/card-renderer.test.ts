import { describe, expect, it } from "vitest";
import {
  canvasToPngBlob,
  measureMixedText,
  renderCard,
  renderThumbnail,
  splitTextRuns,
  wrapLines,
} from "../src/card-renderer";
import { defaultState } from "../src/state-model";

function measuringContext() {
  return {
    font: "",
    measureText: (text: string) => ({ width: text.length * 10 }),
  } as unknown as CanvasRenderingContext2D;
}

function noOpCanvasContext() {
  return new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 6 }),
      canvas: { width: 1080, height: 1440 },
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property as keyof typeof target];
        }
        return () => {};
      },
      set(target, property, value) {
        (target as Record<PropertyKey, unknown>)[property] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

describe("card-renderer helpers", () => {
  it("splits numeric text into number-font runs", () => {
    expect(splitTextRuns("a12b")).toEqual([
      expect.objectContaining({ text: "a" }),
      expect.objectContaining({ text: "12" }),
      expect.objectContaining({ text: "b" }),
    ]);
  });

  it("measures mixed text using every split run", () => {
    expect(measureMixedText(measuringContext(), "abc12", 20, "700")).toBe(50);
  });

  it("wraps text and splits oversized words", () => {
    expect(
      wrapLines(measuringContext(), "Alpha Beta Longword", 50, {
        size: 20,
        weight: "500",
      }),
    ).toEqual(["Alpha", "Beta", "Longw", "ord"]);
  });

  it("rejects PNG export when the canvas cannot produce a blob", async () => {
    const canvas = {
      toBlob: (callback: BlobCallback) => callback(null),
    } as unknown as HTMLCanvasElement;

    await expect(canvasToPngBlob(canvas)).rejects.toThrow(
      "Unable to create PNG export.",
    );
  });

  it("renders thumbnails without throwing when assets or images are missing", () => {
    const canvas = {
      width: 84,
      height: 84,
      getContext: () => noOpCanvasContext(),
    } as unknown as HTMLCanvasElement;

    expect(() =>
      renderThumbnail({
        canvas,
        item: {
          id: "missing",
          kind: "skill",
          sheet: "missing",
          name: "Missing",
        },
        images: {},
      }),
    ).not.toThrow();
  });

  it("renders the default card with a minimal canvas context", () => {
    const previewTitle = { textContent: "" } as HTMLElement;

    expect(() =>
      renderCard({
        ctx: noOpCanvasContext(),
        state: defaultState(),
        images: {},
        colors: {
          template: "templateLinear",
          body: "#111111",
          title: "#222222",
          muted: "#333333",
          ribbonText: "#444444",
          smallRibbonText: "#555555",
          marker: "#666666",
        },
        previewTitle,
      }),
    ).not.toThrow();
    expect(previewTitle.textContent).toBe("Untitled build");
  });
});
