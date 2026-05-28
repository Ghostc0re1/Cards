import {
  BUILD_LIBRARY_SCHEMA_VERSION,
} from "./build-library";
import type { BuildLibrary, BuildRecord } from "./types";

export interface BuildExportPayload {
  version: number;
  schemaVersion: number;
  exportedAt: string;
  activeBuildId: string;
  builds: BuildRecord[];
  deletedBuilds: [];
}

export function buildExportPayload({
  library,
  activeBuild,
  exportedAt = new Date().toISOString(),
}: {
  library: BuildLibrary;
  activeBuild: BuildRecord | undefined;
  exportedAt?: string;
}): BuildExportPayload {
  return {
    version: BUILD_LIBRARY_SCHEMA_VERSION,
    schemaVersion: BUILD_LIBRARY_SCHEMA_VERSION,
    exportedAt,
    activeBuildId: library.activeBuildId,
    builds: activeBuild ? [activeBuild] : library.builds,
    deletedBuilds: [],
  };
}

export function safeFileName(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "card-build"
  );
}

export function downloadJsonPayload(
  payload: unknown,
  filename: string,
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
