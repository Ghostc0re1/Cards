import type {
  BuildState,
  DeviceState,
  EquipmentSetName,
  SkillRowState,
  SlotState,
  ThemeName,
  UpgradeState,
} from "./types";

const STAR_MARKER = "\u2b50";
const validThemeNames = new Set<ThemeName>(["dark", "light", "linear"]);

const legacyGearAssetMap: Record<string, string> = {
  "gear-0": "equipment-def-sword",
  "gear-1": "equipment-def-ring",
  "gear-2": "equipment-def-chest",
  "gear-3": "equipment-def-boots",
  "gear-4": "equipment-atk-sword",
  "gear-5": "equipment-atk-ring",
  "gear-6": "equipment-atk-chest",
  "gear-7": "equipment-atk-boots",
};

const legacySkillAssetMap: Record<string, string> = {
  "skill-0": "skill-dispel",
  "skill-1": "skill-exterminate",
  "skill-2": "skill-heal-reduction",
  "skill-3": "skill-aftershock",
  "skill-4": "skill-m-combo",
  "skill-5": "skill-cleanse",
  "skill-6": "skill-piercing",
  "skill-7": "skill-force",
  "skill-8": "skill-p-combo",
  "skill-9": "skill-iron-wall",
  "skill-10": "skill-agility",
  "skill-11": "skill-blessing",
  "skill-12": "skill-protection",
  "skill-13": "skill-control",
  "skill-14": "skill-devotion",
  "skill-15": "skill-anger",
  "skill-16": "skill-unyielding",
  "skill-17": "skill-toughness",
  "skill-18": "skill-tenacity",
  "skill-19": "skill-lethal",
  "skill-20": "skill-magic",
  "skill-21": "skill-will",
  "skill-22": "skill-chase",
  "skill-23": "skill-medical-skill",
  "skill-24": "skill-berserk",
  "skill-25": "skill-frenzy",
  "skill-26": "skill-recover",
  "skill-27": "skill-dominance",
  "skill-28": "skill-strike",
  "skill-29": "skill-bloodthirst",
  "skill-30": "skill-assault",
  "skill-31": "skill-taunt",
  "skill-32": "skill-armor-break",
  "skill-33": "skill-revival",
  "skill-34": "skill-resurrect",
  "skill-35": "skill-martyr",
  "skill-36": "skill-preparation",
  "skill-37": "skill-lethal",
  "skill-38": "skill-protection",
  "skill-39": "skill-will",
};

export const equipmentSetPresets = {
  defense: {
    name: "Defense",
    label: "Eternal Daylight Set",
    assets: [
      "equipment-def-sword",
      "equipment-def-chest",
      "equipment-def-ring",
      "equipment-def-boots",
    ],
  },
  attack: {
    name: "Attack",
    label: "Dawn Radiance Set",
    assets: [
      "equipment-atk-sword",
      "equipment-atk-chest",
      "equipment-atk-ring",
      "equipment-atk-boots",
    ],
  },
  hybrid: {
    name: "Hybrid",
    label: "Hybrid Set",
    assets: [
      "equipment-atk-sword",
      "equipment-def-chest",
      "equipment-atk-ring",
      "equipment-def-boots",
    ],
  },
} as const satisfies Record<
  Exclude<EquipmentSetName, "">,
  { name: string; label: string; assets: readonly string[] }
>;

export const equipmentSetKeys = Object.keys(
  equipmentSetPresets,
) as Array<Exclude<EquipmentSetName, "">>;
type PresetEquipmentSetName = (typeof equipmentSetKeys)[number];

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
}

function blankSkill(): SlotState {
  return { assetId: "", label: "", marked: false };
}

function blankEquipment(): SlotState {
  return { assetId: "", label: "" };
}

function blankDevice(): DeviceState {
  return { assetId: "", label: "", role: "" };
}

function blankSkillRow(): SkillRowState {
  return { assetId: "", title: "", body: "" };
}

export function defaultState(): BuildState {
  return {
    theme: "linear",
    title: "",
    tags: ["", "", "", ""],
    colors: {
      title: "",
      tags: "",
      body: "",
      banner: "",
      marker: "",
    },
    headers: {
      main: "MAIN SKILLS TO USE",
      situational: "SITUATIONAL SKILLS",
      equipment: "EQUIPMENT",
      devices: "MAGIC DEVICE",
      guide: "How I Use",
      skillWhy: "SKILLS I USE, AND WHY",
      upgraded: "HOW I UPGRADED",
      notes: "MATCH-UP NOTES",
    },
    mainSkills: Array.from({ length: 5 }, blankSkill),
    situationalSkills: Array.from({ length: 4 }, blankSkill),
    equipmentSet: "",
    equipment: Array.from({ length: 4 }, blankEquipment),
    devices: Array.from({ length: 4 }, blankDevice),
    skillRows: Array.from({ length: 5 }, blankSkillRow),
    upgrades: [
      { title: "1. PROGRESSION", body: "" },
      { title: "2. USABLE & VIABLE?", usable: "", viable: "", body: "" },
    ],
    notes: "",
    rank: "",
  };
}

export function wendyState(): BuildState {
  const sample = defaultState();
  sample.theme = "linear";
  sample.title = "Wendy";
  sample.tags = ["Magic", "Forest", "Ancient", ""];
  sample.headers.guide = "How I Use Wendy";
  sample.rank = "SSS";
  sample.mainSkills = [
    { assetId: "skill-m-combo", label: "M. Combo", marked: true },
    { assetId: "skill-control", label: "Control", marked: true },
    { assetId: "skill-agility", label: "Agility", marked: true },
    { assetId: "skill-iron-wall", label: "Iron Wall", marked: true },
    { assetId: "skill-dispel", label: "Dispel", marked: true },
  ];
  sample.situationalSkills = [
    { assetId: "skill-exterminate", label: "Exterminate", marked: false },
    { assetId: "skill-blessing", label: "Blessings", marked: false },
    { assetId: "skill-piercing", label: "Piercing", marked: false },
    { assetId: "skill-protection", label: "Defensive skills", marked: false },
  ];
  sample.equipmentSet = "hybrid";
  sample.equipment = equipmentForSet("hybrid");
  sample.devices = [
    { assetId: "device-0", label: "Mask", role: "Primary Device" },
    { assetId: "device-12", label: "Bleeding Soul", role: "Assigned Device" },
    {
      assetId: "device-3",
      label: "Star Wish",
      role: "Primary Device secondary option",
    },
    { assetId: "device-10", label: "Nightmare", role: "Assigned Device" },
  ];
  sample.skillRows = [
    {
      assetId: "skill-m-combo",
      title: "M. Combo",
      body: "Chance for additional ultimate abilities and more crowd control.",
    },
    {
      assetId: "skill-control",
      title: "Control",
      body: "Additional chance to control the enemy.",
    },
    {
      assetId: "skill-agility",
      title: "Agility",
      body: "Dodge and reduced damage from magic and force.",
    },
    {
      assetId: "skill-iron-wall",
      title: "Iron Wall",
      body: "Reduced damage taken from those using P. Combo and M. Combo.",
    },
    {
      assetId: "skill-dispel",
      title: "Dispel",
      body: "At max can dispel buffs level 1 or below from enemies. Improves survivability.",
    },
  ];
  sample.upgrades = [
    {
      title: "1. PROGRESSION",
      body: "10 star > 11 star a5 > 13 star 30 > Soul Fire 9\nI would recommend placing value in upgrading her domain.",
    },
    {
      title: "2. USABLE & VIABLE?",
      usable: `10 ${STAR_MARKER}`,
      viable: `11 ${STAR_MARKER} a5`,
      body: "Usability and Viability are based on elo. This could be very different depending on numerous factors.",
    },
  ];
  sample.notes =
    "Wendy is a utility mage. She provides buffs and debuffs, and should be used in a similar fashion to Sid. She has high damage potential if played as such, but she truly excels at crowd control.";
  return sample;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeTags(value: unknown): string[] {
  const rawTags = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\u2022|,]/)
        .map((tag) => tag.trim());
  return Array.from({ length: 4 }, (_, index) =>
    String(rawTags[index] || "").trim(),
  );
}

export function normalizeColors(
  base: Record<string, string>,
  incoming: unknown,
): Record<string, string> {
  const source = objectRecord(incoming);
  return Object.fromEntries(
    Object.keys(base).map((key) => {
      const value = String(source[key] || "").trim();
      return [key, /^#[0-9a-f]{6}$/i.test(value) ? value : ""];
    }),
  );
}

export function migrateAssetId(assetId: unknown): string {
  const key = String(assetId || "");
  return legacyGearAssetMap[key] || legacySkillAssetMap[key] || key;
}

export function normalizeEquipmentSet(value: unknown): EquipmentSetName {
  const key = String(value || "") as EquipmentSetName;
  return Object.hasOwn(equipmentSetPresets, key) ? key : "";
}

function equipmentPresetFor(value: unknown) {
  const key = normalizeEquipmentSet(value);
  return key ? equipmentSetPresets[key as PresetEquipmentSetName] : undefined;
}

export function equipmentForSet(value: unknown): SlotState[] {
  const preset = equipmentPresetFor(value);
  return preset
    ? preset.assets.map((assetId: string) => ({ assetId, label: "" }))
    : Array.from({ length: 4 }, blankEquipment);
}

export function equipmentSetLabel(value: unknown): string {
  return equipmentPresetFor(value)?.label || "";
}

export function equipmentAssetIds(equipment: unknown): string[] {
  const slots = Array.isArray(equipment) ? equipment : [];
  return Array.from({ length: 4 }, (_, index) =>
    migrateAssetId(objectRecord(slots[index]).assetId),
  );
}

export function inferEquipmentSet(equipment: unknown): EquipmentSetName {
  const assetIds = equipmentAssetIds(equipment);
  return (
    equipmentSetKeys.find((key) =>
      equipmentSetPresets[key].assets.every(
        (assetId, index) => assetId === assetIds[index],
      ),
    ) || ""
  );
}

export function stripUpgradeNoteMarker(value: unknown): string {
  return String(value || "")
    .replace(/^\s*(?:\u2020\s*)+/, "")
    .trim();
}

export interface LegacyUpgradeTwoBody {
  matched: boolean;
  usable?: string;
  viable?: string;
  body?: string;
}

export function parseLegacyUpgradeTwoBody(value: unknown): LegacyUpgradeTwoBody {
  const text = String(value || "");
  if (!text.trim()) return { matched: false };
  const lines = text.split(/\r?\n/);
  const noteLines: string[] = [];
  let matched = false;
  let usable = "";
  let viable = "";

  for (const line of lines) {
    const match = line
      .trim()
      .match(/^(?:[\u25b8\u2022>*-]\s*)?(usable|viable)\s*:\s*(.*)$/i);
    if (!match) {
      noteLines.push(line);
      continue;
    }
    matched = true;
    if (match[1].toLowerCase() === "usable") usable = match[2].trim();
    if (match[1].toLowerCase() === "viable") viable = match[2].trim();
  }

  return {
    matched,
    usable,
    viable,
    body: stripUpgradeNoteMarker(noteLines.join("\n")),
  };
}

export function normalizeUpgrade(
  base: UpgradeState,
  incoming: unknown,
  index: number,
): UpgradeState {
  const source = objectRecord(incoming);
  const upgrade: UpgradeState = {
    ...base,
    ...source,
    title: String(source.title ?? base.title ?? ""),
    body: String(source.body ?? base.body ?? ""),
  } as UpgradeState;
  if (index !== 1) return upgrade;

  const hasStructuredFields = hasOwn(source, "usable") || hasOwn(source, "viable");
  upgrade.usable = String(source.usable ?? upgrade.usable ?? "");
  upgrade.viable = String(source.viable ?? upgrade.viable ?? "");

  if (!hasStructuredFields) {
    const legacy = parseLegacyUpgradeTwoBody(source.body);
    if (legacy.matched) {
      upgrade.usable = upgrade.usable || legacy.usable || "";
      upgrade.viable = upgrade.viable || legacy.viable || "";
      upgrade.body = legacy.body || "";
      return upgrade;
    }
  }

  upgrade.body = stripUpgradeNoteMarker(upgrade.body);
  return upgrade;
}

function mergeSlotArray<T extends { assetId: string }>(
  base: T[],
  incoming: unknown,
): T[] {
  if (!Array.isArray(incoming)) return clone(base);
  return base.map((item, index) => {
    const mergedItem = {
      ...item,
      ...objectRecord(incoming[index]),
    } as T;
    mergedItem.assetId = migrateAssetId(mergedItem.assetId);
    return mergedItem;
  });
}

export function mergeState(base: BuildState, incoming: unknown): BuildState {
  const source = objectRecord(incoming);
  if (!incoming || typeof incoming !== "object") return clone(base);
  const merged = {
    ...clone(base),
    ...source,
  } as BuildState;

  merged.tags = normalizeTags(source.tags ?? base.tags);
  merged.colors = normalizeColors(base.colors, source.colors);
  merged.headers = {
    ...base.headers,
    ...objectRecord(source.headers),
  } as Record<string, string>;
  merged.mainSkills = mergeSlotArray(base.mainSkills, source.mainSkills);
  merged.situationalSkills = mergeSlotArray(
    base.situationalSkills,
    source.situationalSkills,
  );
  merged.equipment = mergeSlotArray(base.equipment, source.equipment);
  merged.devices = mergeSlotArray(base.devices, source.devices);
  merged.skillRows = mergeSlotArray(base.skillRows, source.skillRows);

  if (hasOwn(source, "equipmentSet")) {
    merged.equipmentSet = normalizeEquipmentSet(source.equipmentSet);
    if (merged.equipmentSet) merged.equipment = equipmentForSet(merged.equipmentSet);
  } else {
    merged.equipmentSet = inferEquipmentSet(merged.equipment);
    if (merged.equipmentSet) merged.equipment = equipmentForSet(merged.equipmentSet);
  }

  const incomingUpgrades = source.upgrades;
  if (Array.isArray(incomingUpgrades)) {
    merged.upgrades = base.upgrades.map((item, index) =>
      normalizeUpgrade(item, incomingUpgrades[index], index),
    );
  } else {
    merged.upgrades = base.upgrades.map((item, index) =>
      normalizeUpgrade(item, null, index),
    );
  }

  if (!validThemeNames.has(merged.theme)) merged.theme = "linear";
  return merged;
}

export function createBuildId(): string {
  if (globalThis.crypto?.randomUUID) return `build-${globalThis.crypto.randomUUID()}`;
  return `build-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildNameFromState(buildState: unknown): string {
  return (
    String(objectRecord(buildState).title || "Untitled build").trim() ||
    "Untitled build"
  );
}
