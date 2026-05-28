export const MAGIC_LINK_COOLDOWN_STORAGE_KEY =
  "card-builder-magic-link-cooldowns-v1";
export const MAGIC_LINK_COOLDOWN_MS = 65 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function currentStorage(): StorageLike | null {
  return typeof globalThis.localStorage === "undefined"
    ? null
    : globalThis.localStorage;
}

export function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function readMagicLinkCooldowns(
  storage: StorageLike | null = currentStorage(),
): Record<string, number> {
  try {
    const parsed = JSON.parse(
      storage?.getItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY) || "{}",
    );
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

export function writeMagicLinkCooldown(
  email: unknown,
  sentAt = Date.now(),
  storage: StorageLike | null = currentStorage(),
): void {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const cooldowns = readMagicLinkCooldowns(storage);
  cooldowns[normalized] = sentAt;
  storage?.setItem(
    MAGIC_LINK_COOLDOWN_STORAGE_KEY,
    JSON.stringify(cooldowns),
  );
}

export function magicLinkCooldownRemaining(
  email: unknown,
  now = Date.now(),
  storage: StorageLike | null = currentStorage(),
): number {
  const normalized = normalizeEmail(email);
  if (!normalized) return 0;
  const sentAt = Number(readMagicLinkCooldowns(storage)[normalized] || 0);
  return Math.max(0, sentAt + MAGIC_LINK_COOLDOWN_MS - now);
}

export function formatCooldown(ms: number): string {
  return `${Math.max(1, Math.ceil(ms / 1000))}s`;
}

export function magicLinkCooldownMessage(prefix: string, email: unknown): string {
  const remaining = magicLinkCooldownRemaining(email);
  if (!remaining) return prefix;
  return `${prefix} Try again in ${formatCooldown(remaining)}.`;
}
