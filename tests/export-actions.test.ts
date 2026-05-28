import { afterEach, describe, expect, it, vi } from "vitest";
import { makeBuildRecord } from "../src/build-library";
import {
  buildExportPayload,
  downloadJsonPayload,
  safeFileName,
} from "../src/export-actions";
import { defaultState } from "../src/state-model";
import type { BuildLibrary } from "../src/types";

describe("export-actions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("builds a single-build export payload without tombstones", () => {
    const active = makeBuildRecord(defaultState(), "Main");
    const other = makeBuildRecord(defaultState(), "Other");
    const library: BuildLibrary = {
      schemaVersion: 3,
      activeBuildId: active.id,
      builds: [active, other],
      deletedBuilds: [{ id: "deleted", deletedAt: "2026-01-01T00:00:00.000Z" }],
    };

    expect(
      buildExportPayload({
        library,
        activeBuild: active,
        exportedAt: "2026-05-26T00:00:00.000Z",
      }),
    ).toEqual({
      version: 3,
      schemaVersion: 3,
      exportedAt: "2026-05-26T00:00:00.000Z",
      activeBuildId: active.id,
      builds: [active],
      deletedBuilds: [],
    });
  });

  it("normalizes filenames for downloads", () => {
    expect(safeFileName(" Wendy: A5 Build! ")).toBe("wendy-a5-build");
    expect(safeFileName("!!!")).toBe("card-build");
  });

  it("downloads JSON payloads and revokes the object URL", () => {
    vi.useFakeTimers();
    const clicks: string[] = [];
    const removed: string[] = [];
    const appended: unknown[] = [];
    const revoked: string[] = [];
    const link = {
      href: "",
      download: "",
      click: () => clicks.push(link.download),
      remove: () => removed.push(link.download),
    };
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:build-json",
      revokeObjectURL: (url: string) => revoked.push(url),
    });
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { append: (item: unknown) => appended.push(item) },
    });
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
    });

    downloadJsonPayload({ ok: true }, "build.json");
    vi.runAllTimers();

    expect(link.href).toBe("blob:build-json");
    expect(link.download).toBe("build.json");
    expect(appended).toEqual([link]);
    expect(clicks).toEqual(["build.json"]);
    expect(removed).toEqual(["build.json"]);
    expect(revoked).toEqual(["blob:build-json"]);
  });
});
