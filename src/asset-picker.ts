import { catalogs, type CardAsset } from "./card-catalog";
import { renderThumbnail } from "./card-renderer";
import type { LoadedImages, PickerKind, PickerState } from "./types";

export function skillLabelPathForAssetPath(path: string): string {
  if (!path.endsWith(".assetId")) return "";
  const basePath = path.slice(0, -".assetId".length);
  if (basePath.startsWith("skillRows.")) return `${basePath}.title`;
  if (
    basePath.startsWith("mainSkills.") ||
    basePath.startsWith("situationalSkills.")
  ) {
    return `${basePath}.label`;
  }
  return "";
}

export function pickerItems(kind: PickerKind): CardAsset[] {
  return catalogs[kind];
}

export function renderAssetPicker({
  kind,
  path,
  grid,
  title,
  images,
}: {
  kind: PickerKind;
  path: string;
  grid: HTMLElement;
  title: HTMLElement;
  images: LoadedImages;
}): PickerState {
  title.textContent = `Choose ${kind}`;
  grid.innerHTML = "";
  for (const item of pickerItems(kind)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `picker-item ${kind}`;
    button.dataset.assetId = item.id;
    const thumb = document.createElement("canvas");
    thumb.width = kind === "device" ? 92 : 84;
    thumb.height = kind === "device" ? 124 : 84;
    const label = document.createElement("span");
    label.textContent = item.name;
    button.append(thumb, label);
    grid.append(button);
    renderThumbnail({ canvas: thumb, item, images });
  }
  return { kind, path };
}
