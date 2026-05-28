const SKILL_ASSET_VERSION = Date.now().toString(36);

export interface CardAsset {
  id: string;
  kind: "skill" | "device" | "gear";
  sheet: string;
  name: string;
  crop?: { x: number; y: number; w: number; h: number };
  autoIconCrop?: boolean;
  mode?: "contain" | "stretch";
}

export const equipmentSourceFiles = [
  {
    id: "equipment-atk-chest",
    key: "equipmentAtkChest",
    name: "ATK Chest",
    path: "assets/equipment/atk-chest.png",
  },
  {
    id: "equipment-atk-ring",
    key: "equipmentAtkRing",
    name: "ATK Ring",
    path: "assets/equipment/atk-ring.png",
  },
  {
    id: "equipment-atk-boots",
    key: "equipmentAtkBoots",
    name: "ATK Boots",
    path: "assets/equipment/atk-boots.png",
  },
  {
    id: "equipment-atk-sword",
    key: "equipmentAtkSword",
    name: "ATK Sword",
    path: "assets/equipment/atk-sword.png",
  },
  {
    id: "equipment-def-chest",
    key: "equipmentDefChest",
    name: "DEF Chest",
    path: "assets/equipment/def-chest.png",
  },
  {
    id: "equipment-def-ring",
    key: "equipmentDefRing",
    name: "DEF Ring",
    path: "assets/equipment/def-ring.png",
  },
  {
    id: "equipment-def-boots",
    key: "equipmentDefBoots",
    name: "DEF Boots",
    path: "assets/equipment/def-boots.png",
  },
  {
    id: "equipment-def-sword",
    key: "equipmentDefSword",
    name: "DEF Sword",
    path: "assets/equipment/def-sword.png",
  },
] as const;

export const skillSourceFiles = [
  { id: "skill-protection", key: "skillProtection", name: "Protection", file: "protection.png" },
  { id: "skill-unyielding", key: "skillUnyielding", name: "Unyielding", file: "unyielding.png" },
  { id: "skill-toughness", key: "skillToughness", name: "Toughness", file: "toughness.png" },
  { id: "skill-lethal", key: "skillLethal", name: "Lethal", file: "lethal.png" },
  { id: "skill-martyr", key: "skillMartyr", name: "Martyr", file: "matyr.png" },
  { id: "skill-iron-wall", key: "skillIronWall", name: "Iron Wall", file: "iron_wall.png" },
  { id: "skill-preparation", key: "skillPreparation", name: "Preparation", file: "preparation.png" },
  { id: "skill-anger", key: "skillAnger", name: "Anger", file: "anger.png" },
  { id: "skill-aftershock", key: "skillAftershock", name: "Aftershock", file: "aftershock.png" },
  { id: "skill-armor-break", key: "skillArmorBreak", name: "Armor Break", file: "armor_break.png" },
  { id: "skill-bloodthirst", key: "skillBloodthirst", name: "Bloodthirst", file: "bloodthirst.png" },
  { id: "skill-will", key: "skillWill", name: "Will", file: "will.png" },
  { id: "skill-strike", key: "skillStrike", name: "Strike", file: "strike.png" },
  { id: "skill-cleanse", key: "skillCleanse", name: "Cleanse", file: "cleanse.png" },
  { id: "skill-dominance", key: "skillDominance", name: "Dominance", file: "dominance.png" },
  { id: "skill-control", key: "skillControl", name: "Control", file: "control.png" },
  { id: "skill-piercing", key: "skillPiercing", name: "Piercing", file: "piercing.png" },
  { id: "skill-medical-skill", key: "skillMedicalSkill", name: "Medical Skill", file: "medical_skill.png" },
  { id: "skill-resurrect", key: "skillResurrect", name: "Resurrect", file: "resurrect.png" },
  { id: "skill-revival", key: "skillRevival", name: "Revival", file: "revival.png" },
  { id: "skill-recover", key: "skillRecover", name: "Recover", file: "recover.png" },
  { id: "skill-blessing", key: "skillBlessing", name: "Blessing", file: "blessings.png" },
  { id: "skill-tenacity", key: "skillTenacity", name: "Tenacity", file: "tenacity.png" },
  { id: "skill-agility", key: "skillAgility", name: "Agility", file: "agility.png" },
  { id: "skill-devotion", key: "skillDevotion", name: "Devotion", file: "devotion.png" },
  { id: "skill-taunt", key: "skillTaunt", name: "Taunt", file: "taunt.png" },
  { id: "skill-assault", key: "skillAssault", name: "Assault", file: "assault.png" },
  { id: "skill-dispel", key: "skillDispel", name: "Dispel", file: "dispel.png" },
  { id: "skill-exterminate", key: "skillExterminate", name: "Exterminate", file: "exterminate.png" },
  { id: "skill-heal-reduction", key: "skillHealReduction", name: "Heal Reduction", file: "heal_reduction.png" },
  { id: "skill-frenzy", key: "skillFrenzy", name: "Frenzy", file: "frenzy.png" },
  { id: "skill-berserk", key: "skillBerserk", name: "Berserk", file: "berserk.png" },
  { id: "skill-chase", key: "skillChase", name: "Chase", file: "chase.png" },
  { id: "skill-force", key: "skillForce", name: "Force", file: "force.png" },
  { id: "skill-magic", key: "skillMagic", name: "Magic", file: "magic.png" },
  { id: "skill-p-combo", key: "skillPCombo", name: "P. Combo", file: "pcombo.png" },
  { id: "skill-m-combo", key: "skillMCombo", name: "M. Combo", file: "mcombo.png" },
] as const;

export const assetPaths = {
  templateDark: "assets/template-dark.png",
  templateLight: "assets/template-light.png",
  templateLinear: "assets/template-linear.png",
  device: "assets/device-icons.png",
  ...Object.fromEntries(
    skillSourceFiles.map((item) => [
      item.key,
      `assets/skills/${item.file}?v=${SKILL_ASSET_VERSION}`,
    ]),
  ),
  ...Object.fromEntries(
    equipmentSourceFiles.map((item) => [item.key, item.path]),
  ),
};

const deviceNames = [
  "Phantom of the Opera",
  "Thunderclap",
  "Lamp of Desire",
  "Star Wish",
  "Void Prism",
  "Starry River",
  "Lake Oscillation",
  "Truth Sound",
  "Brilliant Crown",
  "Horse Spirit",
  "Nightmare",
  "Imprisoned Soul",
  "Bleeding Soul",
  "Resurge Cocoon",
  "Astrological Orb",
  "Butterfly Pact",
  "Gold Prophecy",
  "Wheel Of Time",
  "Self-View Mirror",
  "Soul Guidance",
  "Pro-Life Mirror",
  "Acala",
];

export const skillAssets: CardAsset[] = skillSourceFiles.map((item) => ({
  id: item.id,
  kind: "skill",
  sheet: item.key,
  name: item.name,
  autoIconCrop: true,
  mode: "contain",
}));

export const deviceAssets: CardAsset[] = [];
const deviceX = [0, 162, 324, 486, 648];
const deviceY = [0, 229, 458, 687, 916];
for (let row = 0; row < deviceY.length; row += 1) {
  for (let col = 0; col < deviceX.length; col += 1) {
    const index = row * deviceX.length + col;
    if (index >= deviceNames.length) continue;
    deviceAssets.push({
      id: `device-${index}`,
      kind: "device",
      sheet: "device",
      name: deviceNames[index],
      crop:
        index === 3
          ? { x: deviceX[col], y: deviceY[row], w: 100, h: 148 }
          : { x: deviceX[col], y: deviceY[row], w: 112, h: 148 },
      mode: "stretch",
    });
  }
}

export const gearAssets: CardAsset[] = equipmentSourceFiles.map((item) => ({
  id: item.id,
  kind: "gear",
  sheet: item.key,
  name: item.name,
  mode: "stretch",
}));

export const catalogs = {
  skill: skillAssets,
  device: deviceAssets,
  gear: gearAssets,
};

export const catalogById = new Map(
  [...skillAssets, ...deviceAssets, ...gearAssets].map((item) => [
    item.id,
    item,
  ]),
);

export function assetName(assetId: string): string {
  return catalogById.get(assetId)?.name || "Choose";
}
