import {
  catalogById as defaultCatalogById,
  type CardAsset,
} from "./card-catalog";
import {
  CARD_FONT,
  EXPORT_SIZE,
  NUMBER_FONT,
  SOURCE_SIZE,
  USABILITY_BULLET,
  USABILITY_NOTE_MARKER,
  deviceSlots,
  equipmentSlots,
  mainSkillSlots,
  situationalSkillSlots,
  skillRows,
  textStyles,
  upgradeBlocks,
} from "./card-layout";
import { equipmentSetLabel, normalizeTags, stripUpgradeNoteMarker } from "./state-model";
import type { BuildState, LoadedImages, RenderBox, SlotState, UpgradeState } from "./types";

type AssetCatalog = Map<string, CardAsset>;
type TextAlign = "left" | "center" | "right";
type TextBaseline = CanvasTextBaseline;

interface TextOptions {
  size?: number;
  minSize?: number;
  weight?: string;
  color?: string;
  baseline?: TextBaseline;
  align?: TextAlign;
  lineHeight?: number;
  maxLines?: number;
  maxHeight?: number;
  clip?: boolean;
  padding?: number;
}

interface ThemeColors {
  template: string;
  body: string;
  title: string;
  muted: string;
  ribbonText: string;
  smallRibbonText: string;
  marker: string;
}

interface DrawAssetOptions {
  cropKey?: string;
  mode?: "contain" | "stretch";
  padding?: number;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderCardOptions {
  ctx: CanvasRenderingContext2D;
  state: BuildState;
  images: LoadedImages;
  colors: ThemeColors;
  previewTitle?: HTMLElement;
  catalogById?: AssetCatalog;
}

export interface RenderThumbnailOptions {
  canvas: HTMLCanvasElement;
  item: CardAsset;
  images: LoadedImages;
  catalogById?: AssetCatalog;
}

export function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

export async function loadCardImages(
  paths: Record<string, string>,
): Promise<LoadedImages> {
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, src]) => [
      key,
      await createImage(src),
    ]),
  );
  return Object.fromEntries(entries);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

let cardFontsReadyPromise: Promise<unknown> | null = null;

export function ensureCardFontsReady(): Promise<unknown> {
  if (!document.fonts) return Promise.resolve();
  if (!cardFontsReadyPromise) {
    cardFontsReadyPromise = Promise.race([
      Promise.allSettled([
        document.fonts.load(fontSpec(62, "700", CARD_FONT)),
        document.fonts.load(fontSpec(24, "600", CARD_FONT)),
        document.fonts.load(fontSpec(16, "500", NUMBER_FONT)),
        document.fonts.ready,
      ]),
      wait(2500),
    ]);
  }
  return cardFontsReadyPromise;
}

function fontSpec(size: number, weight = "400", family = CARD_FONT): string {
  return `${weight} ${size}px ${family}`;
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight = "400",
  family = CARD_FONT,
): void {
  context.font = fontSpec(size, weight, family);
}

interface TextRun {
  text: string;
  family: string;
}

export function splitTextRuns(text: unknown): TextRun[] {
  return String(text || "")
    .split(/(\d+)/g)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      family: /\d/.test(part) ? NUMBER_FONT : CARD_FONT,
    }));
}

export function measureMixedText(
  context: CanvasRenderingContext2D,
  text: unknown,
  size: number,
  weight: string,
): number {
  return splitTextRuns(text).reduce((width, run) => {
    setFont(context, size, weight, run.family);
    return width + context.measureText(run.text).width;
  }, 0);
}

function drawMixedTextLine(
  context: CanvasRenderingContext2D,
  text: unknown,
  x: number,
  y: number,
  options: TextOptions = {},
): void {
  const size = options.size || 24;
  const weight = options.weight || "400";
  const align = options.align || "left";
  let cursor = x;
  const width = measureMixedText(context, text, size, weight);
  if (align === "center") cursor = x - width / 2;
  if (align === "right") cursor = x - width;
  for (const run of splitTextRuns(text)) {
    setFont(context, size, weight, run.family);
    context.fillText(run.text, cursor, y);
    cursor += context.measureText(run.text).width;
  }
}

function drawFitText(
  context: CanvasRenderingContext2D,
  text: unknown,
  x: number,
  y: number,
  maxWidth: number,
  options: TextOptions = {},
): void {
  if (!text) return;
  const weight = options.weight || "700";
  let size = options.size || 24;
  const minSize = options.minSize || 10;
  context.save();
  context.fillStyle = options.color || "#ffffff";
  context.textBaseline = options.baseline || "middle";
  while (size > minSize) {
    if (measureMixedText(context, text, size, weight) <= maxWidth) break;
    size -= 1;
  }
  drawMixedTextLine(context, text, x, y, {
    size,
    weight,
    align: options.align || "center",
  });
  context.restore();
}

function splitOversizedWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
  size: number,
  weight: string,
): string[] {
  if (measureMixedText(context, word, size, weight) <= maxWidth) return [word];
  const chunks: string[] = [];
  let chunk = "";
  for (const character of Array.from(word)) {
    const test = `${chunk}${character}`;
    if (chunk && measureMixedText(context, test, size, weight) > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = test;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function wrapLines(
  context: CanvasRenderingContext2D,
  text: unknown,
  maxWidth: number,
  options: TextOptions = {},
): string[] {
  const size = options.size || 18;
  const weight = options.weight || "400";
  const paragraphs = String(text || "").split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const wordParts = splitOversizedWord(
        context,
        word,
        maxWidth,
        size,
        weight,
      );
      for (const part of wordParts) {
        const test = line ? `${line} ${part}` : part;
        if (measureMixedText(context, test, size, weight) <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = part;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function ellipsizeLine(
  context: CanvasRenderingContext2D,
  line: unknown,
  maxWidth: number,
  size: number,
  weight: string,
): string {
  const ellipsis = "...";
  let trimmed = String(line || "").trimEnd();
  while (
    trimmed.length > 0 &&
    measureMixedText(context, `${trimmed}${ellipsis}`, size, weight) > maxWidth
  ) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }
  return trimmed ? `${trimmed}${ellipsis}` : ellipsis;
}

interface WrappedLayout {
  size: number;
  lineHeight: number;
  lines: string[];
}

function fittedWrappedLines(
  context: CanvasRenderingContext2D,
  text: unknown,
  maxWidth: number,
  options: TextOptions = {},
): WrappedLayout {
  let size = options.size || 18;
  const minSize = options.minSize || Math.max(9, size - 4);
  const weight = options.weight || "400";
  while (size > minSize) {
    const lineHeight = options.lineHeight || Math.round(size * 1.25);
    const maxLines =
      options.maxLines ||
      Math.max(1, Math.floor((options.maxHeight || 9999) / lineHeight));
    const lines = wrapLines(context, text, maxWidth, { size, weight });
    if (lines.length <= maxLines) return { size, lineHeight, lines };
    size -= 1;
  }
  const lineHeight = options.lineHeight || Math.round(size * 1.25);
  const maxLines =
    options.maxLines ||
    Math.max(1, Math.floor((options.maxHeight || 9999) / lineHeight));
  const lines = wrapLines(context, text, maxWidth, { size, weight });
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    visible[visible.length - 1] = ellipsizeLine(
      context,
      visible[visible.length - 1],
      maxWidth,
      size,
      weight,
    );
  }
  return { size, lineHeight, lines: visible };
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: unknown,
  x: number,
  y: number,
  maxWidth: number,
  options: TextOptions = {},
): void {
  if (!text) return;
  const maxHeight =
    options.maxHeight ||
    (options.maxLines
      ? (options.lineHeight || Math.round((options.size || 18) * 1.25)) *
        options.maxLines
      : undefined);
  const layout = fittedWrappedLines(context, text, maxWidth, {
    ...options,
    maxHeight,
  });
  const align = options.align || "left";
  const lineX =
    align === "center"
      ? x + maxWidth / 2
      : align === "right"
        ? x + maxWidth
        : x;
  context.save();
  context.fillStyle = options.color || "#ffffff";
  context.textBaseline = "top";
  if (maxHeight || options.clip) {
    context.beginPath();
    context.rect(
      x,
      y,
      maxWidth,
      maxHeight || layout.lineHeight * layout.lines.length,
    );
    context.clip();
  }
  for (let index = 0; index < layout.lines.length; index += 1) {
    drawMixedTextLine(
      context,
      layout.lines[index],
      lineX,
      y + index * layout.lineHeight,
      {
        size: layout.size,
        weight: options.weight || "400",
        align,
      },
    );
  }
  context.restore();
}

function renderUpgradeTwoBody(
  context: CanvasRenderingContext2D,
  upgrade: UpgradeState,
  block: (typeof upgradeBlocks)[number],
  colors: ThemeColors,
): void {
  const maxHeight = block.body.lineHeight * block.body.maxLines;
  const rowHeight = 20;
  let cursorY = block.body.y;
  const rows = [
    upgrade.usable
      ? `${USABILITY_BULLET} Usable: ${String(upgrade.usable).trim()}`
      : "",
    upgrade.viable
      ? `${USABILITY_BULLET} Viable: ${String(upgrade.viable).trim()}`
      : "",
  ].filter(Boolean);

  context.save();
  context.beginPath();
  context.rect(block.body.x, block.body.y, block.body.w, maxHeight);
  context.clip();

  for (const row of rows) {
    drawWrappedText(context, row, block.body.x, cursorY, block.body.w, {
      ...textStyles.upgradeBody,
      size: 14,
      minSize: 10,
      lineHeight: 18,
      maxLines: 1,
      maxHeight: 18,
      clip: true,
      color: colors.body,
    });
    cursorY += rowHeight;
  }

  const note = stripUpgradeNoteMarker(upgrade.body);
  const remainingHeight = block.body.y + maxHeight - cursorY;
  if (note && remainingHeight > 0) {
    drawWrappedText(
      context,
      `${USABILITY_NOTE_MARKER}${note}`,
      block.body.x,
      cursorY,
      block.body.w,
      {
        size: 12,
        minSize: 10,
        weight: "500",
        lineHeight: 15,
        maxHeight: remainingHeight,
        clip: true,
        color: colors.body,
      },
    );
  }

  context.restore();
}

const cropCache = new Map<string, CropBox>();

function naturalSize(image: HTMLImageElement): { width: number; height: number } {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

function alphaBounds(asset: CardAsset, image: HTMLImageElement): CropBox {
  const cacheKey = `${asset.id}:alpha`;
  const cached = cropCache.get(cacheKey);
  if (cached) return cached;
  const size = naturalSize(image);
  const fallback = { x: 0, y: 0, w: size.width, h: size.height };
  try {
    const scratch = document.createElement("canvas");
    scratch.width = size.width;
    scratch.height = size.height;
    const scratchContext = scratch.getContext("2d", {
      willReadFrequently: true,
    });
    if (!scratchContext) return fallback;
    scratchContext.drawImage(image, 0, 0);
    const pixels = scratchContext.getImageData(
      0,
      0,
      size.width,
      size.height,
    ).data;
    let minX = size.width;
    let minY = size.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        if (pixels[(y * size.width + x) * 4 + 3] <= 10) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) return fallback;
    const crop = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    cropCache.set(cacheKey, crop);
    return crop;
  } catch {
    cropCache.set(cacheKey, fallback);
    return fallback;
  }
}

function resolveAssetCrop(
  asset: CardAsset,
  image: HTMLImageElement,
  cropKey: string,
): CropBox {
  if (asset.autoIconCrop && cropKey === "alphaCrop") {
    return alphaBounds(asset, image);
  }
  if (asset.autoIconCrop && cropKey === "circleCrop") {
    return alphaBounds(asset, image);
  }
  if (asset.autoIconCrop && cropKey === "iconCrop") {
    const bounds = alphaBounds(asset, image);
    const imageSize = naturalSize(image);
    const size = Math.min(
      bounds.w,
      imageSize.width - bounds.x,
      imageSize.height - bounds.y,
    );
    return { x: bounds.x, y: bounds.y, w: size, h: size };
  }
  return (
    asset.crop || {
      x: 0,
      y: 0,
      w: image.naturalWidth || image.width,
      h: image.naturalHeight || image.height,
    }
  );
}

function drawAsset(
  context: CanvasRenderingContext2D,
  assetId: string,
  box: RenderBox,
  images: LoadedImages,
  catalogById: AssetCatalog,
  options: DrawAssetOptions = {},
): void {
  const asset = catalogById.get(assetId);
  if (!asset || !images[asset.sheet]) return;
  const image = images[asset.sheet];
  const cropKey = options.cropKey || "crop";
  const crop = resolveAssetCrop(asset, image, cropKey);
  const mode = options.mode || asset.mode || "contain";
  if (mode === "stretch") {
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      box.x,
      box.y,
      box.w,
      box.h,
    );
    return;
  }
  const padding = options.padding || 0;
  const target = {
    x: box.x + padding,
    y: box.y + padding,
    w: Math.max(1, box.w - padding * 2),
    h: Math.max(1, box.h - padding * 2),
  };
  const ratio = Math.min(target.w / crop.w, target.h / crop.h);
  const width = crop.w * ratio;
  const height = crop.h * ratio;
  const dx = target.x + (target.w - width) / 2;
  const dy = target.y + (target.h - height) / 2;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    dx,
    dy,
    width,
    height,
  );
}

function drawMarker(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.save();
  context.fillStyle = color;
  context.strokeStyle = "rgba(18, 36, 62, 0.85)";
  context.lineWidth = 1.25;
  context.beginPath();
  const outer = 8;
  const inner = 3.5;
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + index * (Math.PI / 5);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function renderSkillSlot(
  context: CanvasRenderingContext2D,
  slot: (typeof mainSkillSlots)[number],
  data: SlotState,
  colors: ThemeColors,
  images: LoadedImages,
  catalogById: AssetCatalog,
): void {
  context.save();
  context.beginPath();
  context.arc(
    slot.icon.x + slot.icon.w / 2,
    slot.icon.y + slot.icon.h / 2,
    slot.clipRadius || slot.icon.w / 2,
    0,
    Math.PI * 2,
  );
  context.clip();
  drawAsset(context, data.assetId, slot.icon, images, catalogById, {
    cropKey: "circleCrop",
    mode: "contain",
  });
  context.restore();
  drawFitText(context, data.label, slot.label.x, slot.label.y, slot.label.w, {
    ...textStyles.skillLabel,
    color: colors.body,
  });
  if (data.marked) {
    drawMarker(context, slot.marker.x, slot.marker.y, colors.marker);
  }
}

function renderHeader(
  context: CanvasRenderingContext2D,
  text: unknown,
  rect: RenderBox & { cx?: number; cy?: number },
  colors: ThemeColors,
  options: TextOptions = {},
): void {
  if (!text) return;
  const padding = options.padding ?? 18;
  drawFitText(
    context,
    text,
    rect.cx || rect.x + rect.w / 2,
    rect.cy || rect.y + rect.h / 2,
    rect.w - padding,
    {
      size: options.size || textStyles.banner.size,
      minSize: options.minSize || textStyles.banner.minSize,
      weight: options.weight || textStyles.banner.weight,
      color: options.color || colors.ribbonText,
    },
  );
}

export function renderCard({
  ctx,
  state,
  images,
  colors,
  previewTitle,
  catalogById = defaultCatalogById,
}: RenderCardOptions): void {
  const scaleX = EXPORT_SIZE.width / SOURCE_SIZE.width;
  const scaleY = EXPORT_SIZE.height / SOURCE_SIZE.height;

  ctx.clearRect(0, 0, EXPORT_SIZE.width, EXPORT_SIZE.height);
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    images[colors.template],
    0,
    0,
    SOURCE_SIZE.width,
    SOURCE_SIZE.height,
  );

  drawFitText(ctx, state.title, 543, 86, 620, {
    ...textStyles.title,
    color: colors.title,
  });
  drawFitText(
    ctx,
    normalizeTags(state.tags).filter(Boolean).slice(0, 4).join(" \u2022 "),
    543,
    158,
    430,
    {
      ...textStyles.tags,
      color: colors.muted,
    },
  );

  renderHeader(
    ctx,
    state.headers.equipment,
    { x: 184, y: 456, w: 176, h: 30, cx: 272, cy: 473 },
    colors,
    textStyles.banner,
  );
  renderHeader(
    ctx,
    state.headers.devices,
    { x: 622, y: 456, w: 280, h: 30, cx: 762, cy: 473 },
    colors,
    textStyles.banner,
  );
  renderHeader(
    ctx,
    state.headers.guide,
    { x: 205, y: 763, w: 658, h: 41, cx: 534, cy: 786 },
    colors,
    textStyles.guide,
  );
  renderHeader(
    ctx,
    state.headers.notes,
    { x: 393, y: 1227, w: 300, h: 34, cx: 543, cy: 1246 },
    colors,
    textStyles.banner,
  );
  renderHeader(
    ctx,
    state.rank,
    { x: 355, y: 1385, w: 376, h: 36, cx: 543, cy: 1405 },
    colors,
    textStyles.rank,
  );

  state.mainSkills.forEach((skill, index) =>
    renderSkillSlot(ctx, mainSkillSlots[index], skill, colors, images, catalogById),
  );
  state.situationalSkills.forEach((skill, index) =>
    renderSkillSlot(
      ctx,
      situationalSkillSlots[index],
      skill,
      colors,
      images,
      catalogById,
    ),
  );

  state.equipment.forEach((gear, index) => {
    drawAsset(ctx, gear.assetId, equipmentSlots[index].box, images, catalogById);
  });
  drawFitText(ctx, equipmentSetLabel(state.equipmentSet), 284, 704, 330, {
    ...textStyles.equipmentSet,
    color: colors.body,
  });

  state.devices.forEach((device, index) => {
    const slot = deviceSlots[index];
    drawAsset(ctx, device.assetId, slot.box, images, catalogById);
    drawFitText(ctx, device.label, slot.label.x, slot.label.y, slot.label.w, {
      ...textStyles.deviceLabel,
      color: colors.body,
    });
    drawWrappedText(
      ctx,
      device.role,
      slot.role.x - slot.role.w / 2,
      slot.role.y,
      slot.role.w,
      {
        ...textStyles.deviceRole,
        align: "center",
        maxHeight:
          textStyles.deviceRole.lineHeight * textStyles.deviceRole.maxLines,
        clip: true,
        color: colors.body,
      },
    );
  });

  state.skillRows.forEach((row, index) => {
    const slot = skillRows[index];
    drawAsset(ctx, row.assetId, slot.icon, images, catalogById, {
      cropKey: "circleCrop",
    });
    drawFitText(ctx, row.title, slot.title.x, slot.title.y, slot.title.w, {
      ...textStyles.skillRowTitle,
      align: "left",
      color: colors.body,
    });
    drawWrappedText(ctx, row.body, slot.body.x, slot.body.y, slot.body.w, {
      ...textStyles.skillRowBody,
      maxHeight:
        textStyles.skillRowBody.lineHeight * textStyles.skillRowBody.maxLines,
      clip: true,
      color: colors.body,
    });
  });

  state.upgrades.forEach((upgrade, index) => {
    const block = upgradeBlocks[index];
    renderHeader(ctx, upgrade.title, block.header, colors, {
      color: colors.smallRibbonText,
      ...textStyles.upgradeTitle,
      padding: 10,
    });
    if (index === 1) {
      renderUpgradeTwoBody(ctx, upgrade, block, colors);
    } else {
      drawWrappedText(
        ctx,
        upgrade.body,
        block.body.x,
        block.body.y,
        block.body.w,
        {
          ...textStyles.upgradeBody,
          lineHeight: block.body.lineHeight,
          maxLines: block.body.maxLines,
          maxHeight: block.body.lineHeight * block.body.maxLines,
          clip: true,
          color: colors.body,
        },
      );
    }
  });

  drawWrappedText(ctx, state.notes, 174, 1276, 740, {
    ...textStyles.notes,
    maxHeight: textStyles.notes.lineHeight * textStyles.notes.maxLines,
    clip: true,
    color: colors.body,
  });

  ctx.restore();
  if (previewTitle) previewTitle.textContent = state.title || "Untitled build";
}

export function renderThumbnail({
  canvas,
  item,
  images,
  catalogById = defaultCatalogById,
}: RenderThumbnailOptions): void {
  const thumbContext = canvas.getContext("2d");
  if (!thumbContext) return;
  thumbContext.clearRect(0, 0, canvas.width, canvas.height);
  const options = item.kind === "skill" ? { cropKey: "alphaCrop" } : {};
  drawAsset(
    thumbContext,
    item.id,
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    images,
    catalogById,
    options,
  );
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to create PNG export."));
    }, "image/png");
  });
}
