import type { InteractiveRegion } from "./types";

export const SOURCE_SIZE = { width: 1086, height: 1448 };
export const EXPORT_SIZE = { width: 1080, height: 1440 };
export const CARD_FONT = '"Cormorant Garamond", Georgia, serif';
export const NUMBER_FONT = '"Cormorant Infant", "Cormorant Garamond", Georgia, serif';
export const USABILITY_BULLET = "\u25b8";
export const USABILITY_NOTE_MARKER = "\u2020";

export const textStyles = {
  title: { size: 76, minSize: 32, weight: "700" },
  tags: { size: 25, minSize: 13, weight: "600" },
  banner: { size: 25, minSize: 13, weight: "700" },
  guide: { size: 30, minSize: 16, weight: "700" },
  rank: { size: 33, minSize: 17, weight: "700" },
  skillLabel: { size: 20, minSize: 12, weight: "500" },
  deviceLabel: { size: 20, minSize: 11, weight: "500" },
  equipmentSet: { size: 20, minSize: 12, weight: "600" },
  deviceRole: { size: 13, minSize: 10, lineHeight: 15, maxLines: 2, weight: "500" },
  skillRowTitle: { size: 25, minSize: 13, weight: "500" },
  skillRowBody: { size: 16, minSize: 11, lineHeight: 18, maxLines: 2, weight: "500" },
  upgradeTitle: { size: 13, minSize: 9, weight: "700" },
  upgradeBody: { size: 15, minSize: 10, weight: "500" },
  notes: { size: 17, minSize: 12, lineHeight: 26, maxLines: 5, weight: "500" },
};

export const themeConfig = {
  dark: {
    template: "templateDark",
    body: "#efe5d2",
    title: "#dbe7ff",
    muted: "#c7d4e8",
    ribbonFill: "#ece5d9",
    ribbonText: "#111820",
    smallRibbonFill: "#ece5d9",
    smallRibbonText: "#111820",
    marker: "#f2e8cc",
  },
  light: {
    template: "templateLight",
    body: "#243247",
    title: "#17223a",
    muted: "#4d5a6f",
    ribbonFill: "#26384a",
    ribbonText: "#fff8e8",
    smallRibbonFill: "#26384a",
    smallRibbonText: "#fff8e8",
    marker: "#31445b",
  },
  linear: {
    template: "templateLinear",
    body: "#f1e8d5",
    title: "#17233e",
    muted: "#d8d9dc",
    ribbonFill: "#f4f2ed",
    ribbonText: "#111820",
    smallRibbonFill: "#f4f2ed",
    smallRibbonText: "#111820",
    marker: "#f4f2ed",
  },
};

export const mainSkillSlots = [108, 213, 315, 421, 523].map((cx, index) => ({
  cx,
  icon: { x: cx - 45, y: 255, w: 90, h: 90 },
  clipRadius: 45,
  label: { x: cx, y: 374, w: 104 },
  marker: { x: cx, y: 402 },
  hit: { x: cx - 58, y: 243, w: 116, h: 174 },
  path: `mainSkills.${index}.assetId`,
  labelPath: `mainSkills.${index}.label`,
}));

const situationalSkillIconXOffsets = [0, -3, -2, 0];
export const situationalSkillSlots = [661, 769, 874, 981].map((cx, index) => ({
  cx,
  icon: { x: cx - 45 + situationalSkillIconXOffsets[index], y: 255, w: 90, h: 90 },
  clipRadius: 45,
  label: { x: cx, y: 374, w: 106 },
  marker: { x: cx, y: 402 },
  hit: { x: cx - 58, y: 243, w: 116, h: 174 },
  path: `situationalSkills.${index}.assetId`,
  labelPath: `situationalSkills.${index}.label`,
}));

const equipmentPositions = [
  { x: 128, y: 512 },
  { x: 193, y: 526 },
  { x: 258, y: 540 },
  { x: 323, y: 554 },
];

export const equipmentSlots = equipmentPositions.map((position, index) => ({
  box: { x: position.x, y: position.y, w: 116, h: 116 },
  hit: { x: position.x - 8, y: position.y - 12, w: 132, h: 140 },
  path: `equipment.${index}.assetId`,
  labelPath: `equipment.${index}.label`,
}));

export const deviceSlots = [516, 658, 790, 924].map((x, index) => ({
  box: { x, y: 502, w: 110, h: 155 },
  label: { x: x + 55, y: 684, w: 118 },
  role: { x: x + 55, y: 711, w: 118 },
  hit: { x: x - 8, y: 493, w: 124, h: 240 },
  path: `devices.${index}.assetId`,
  labelPath: `devices.${index}.label`,
  rolePath: `devices.${index}.role`,
}));

export const skillRows = [860, 928, 996, 1062, 1130].map((y, index) => ({
  icon: { x: 70, y, w: 58, h: 58 },
  title: { x: 142, y: y + 25, w: 260 },
  body: { x: 142, y: y + 47, w: 520 },
  hit: { x: 58, y: y - 12, w: 86, h: 76 },
  path: `skillRows.${index}.assetId`,
  titlePath: `skillRows.${index}.title`,
  bodyPath: `skillRows.${index}.body`,
}));

export const upgradeBlocks = [
  {
    header: { x: 724, y: 865, w: 176, h: 30, cx: 812, cy: 884 },
    body: { x: 726, y: 922, w: 282, lineHeight: 22, maxLines: 5 },
    titlePath: "upgrades.0.title",
    bodyPath: "upgrades.0.body",
  },
  {
    header: { x: 724, y: 1029, w: 176, h: 30, cx: 812, cy: 1048 },
    body: { x: 726, y: 1086, w: 282, lineHeight: 22, maxLines: 4 },
    titlePath: "upgrades.1.title",
    usablePath: "upgrades.1.usable",
    viablePath: "upgrades.1.viable",
    bodyPath: "upgrades.1.body",
  },
];

export const readOnlyHeaderLabels = [
  ["Main skills header", "headers.main"],
  ["Situational skills header", "headers.situational"],
  ["Skill notes header", "headers.skillWhy"],
  ["Upgrade header", "headers.upgraded"],
];

export const editableHeaderLabels = [
  ["Equipment header", "headers.equipment"],
  ["Device header", "headers.devices"],
  ["Guide header", "headers.guide"],
  ["Match-up header", "headers.notes"],
  ["Footer / rank", "rank"],
];

export function sectionKeyForPath(path: string): string {
  if (!path) return "";
  if (path.startsWith("mainSkills.")) return "main-skills";
  if (path.startsWith("situationalSkills.")) return "situational-skills";
  if (path === "equipmentSet") return "equipment";
  if (path.startsWith("equipment.")) return "equipment";
  if (path.startsWith("devices.")) return "magic-devices";
  if (path.startsWith("skillRows.")) return "skills-i-use-and-why";
  if (path.startsWith("upgrades.")) return "how-i-upgraded";
  if (path === "title" || path === "notes" || path.startsWith("tags.")) {
    return "character-and-notes";
  }
  if (path.startsWith("headers.") || path === "rank") return "section-text";
  if (path.startsWith("colors.")) return "font-colors";
  return "";
}

export function interactiveRegions(): InteractiveRegion[] {
  const regions: InteractiveRegion[] = [];
  for (const slot of mainSkillSlots) {
    regions.push({ type: "picker", kind: "skill", path: slot.path, rect: slot.hit });
    regions.push({
      type: "field",
      path: slot.labelPath,
      rect: { x: slot.label.x - 56, y: 352, w: 112, h: 40 },
    });
  }
  for (const slot of situationalSkillSlots) {
    regions.push({ type: "picker", kind: "skill", path: slot.path, rect: slot.hit });
    regions.push({
      type: "field",
      path: slot.labelPath,
      rect: { x: slot.label.x - 58, y: 352, w: 116, h: 40 },
    });
  }
  regions.push({
    type: "field",
    path: "equipmentSet",
    rect: { x: 112, y: 492, w: 348, h: 238 },
  });
  for (const slot of deviceSlots) {
    regions.push({ type: "picker", kind: "device", path: slot.path, rect: slot.hit });
    regions.push({ type: "field", path: slot.labelPath, rect: { x: slot.label.x - 60, y: 665, w: 120, h: 30 } });
    regions.push({ type: "field", path: slot.rolePath, rect: { x: slot.role.x - 60, y: 696, w: 120, h: 44 } });
  }
  for (const slot of skillRows) {
    regions.push({ type: "picker", kind: "skill", path: slot.path, rect: slot.hit });
    regions.push({ type: "field", path: slot.titlePath, rect: { x: slot.title.x, y: slot.title.y - 24, w: slot.title.w, h: 34 } });
    regions.push({ type: "field", path: slot.bodyPath, rect: { x: slot.body.x, y: slot.body.y - 7, w: slot.body.w, h: 44 } });
  }
  regions.push({ type: "field", path: "title", rect: { x: 320, y: 35, w: 446, h: 84 } });
  regions.push({ type: "field", path: "tags.0", rect: { x: 330, y: 132, w: 426, h: 48 } });
  regions.push({ type: "field", path: "headers.equipment", rect: { x: 166, y: 448, w: 216, h: 48 } });
  regions.push({ type: "field", path: "headers.devices", rect: { x: 645, y: 448, w: 278, h: 48 } });
  regions.push({ type: "field", path: "headers.guide", rect: { x: 190, y: 756, w: 690, h: 56 } });
  regions.push({ type: "field", path: "headers.notes", rect: { x: 376, y: 1218, w: 334, h: 56 } });
  regions.push({ type: "field", path: "notes", rect: { x: 150, y: 1264, w: 790, h: 120 } });
  regions.push({ type: "field", path: "rank", rect: { x: 340, y: 1376, w: 406, h: 55 } });
  for (const [index, block] of upgradeBlocks.entries()) {
    regions.push({ type: "field", path: block.titlePath, rect: block.header });
    if (index === 1) {
      const bodyTop = block.body.y - 10;
      const bodyHeight = block.body.lineHeight * block.body.maxLines + 15;
      const rowHeight = 24;
      regions.push({ type: "field", path: block.usablePath || "", rect: { x: block.body.x, y: bodyTop, w: block.body.w, h: rowHeight } });
      regions.push({ type: "field", path: block.viablePath || "", rect: { x: block.body.x, y: bodyTop + rowHeight, w: block.body.w, h: rowHeight } });
      regions.push({ type: "field", path: block.bodyPath, rect: { x: block.body.x, y: bodyTop + rowHeight * 2, w: block.body.w, h: bodyHeight - rowHeight * 2 } });
    } else {
      regions.push({
        type: "field",
        path: block.bodyPath,
        rect: { x: block.body.x, y: block.body.y - 10, w: block.body.w, h: block.body.lineHeight * block.body.maxLines + 15 },
      });
    }
  }
  return regions;
}

export function inRect(point: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function sourcePointFromClientPoint(
  point: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
  sourceSize = SOURCE_SIZE,
): { x: number; y: number } {
  return {
    x: ((point.clientX - rect.left) / rect.width) * sourceSize.width,
    y: ((point.clientY - rect.top) / rect.height) * sourceSize.height,
  };
}
