import { describe, expect, it } from "vitest";
import {
  MAGIC_LINK_COOLDOWN_MS,
  MAGIC_LINK_COOLDOWN_STORAGE_KEY,
  formatCooldown,
  magicLinkCooldownRemaining,
  normalizeEmail,
  readMagicLinkCooldowns,
  writeMagicLinkCooldown,
} from "../src/magic-link-cooldown";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("magic-link-cooldown", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail("  Builder@Example.COM ")).toBe(
      "builder@example.com",
    );
  });

  it("stores timestamps and computes remaining cooldown", () => {
    const storage = memoryStorage();
    writeMagicLinkCooldown("builder@example.com", 1000, storage);

    expect(readMagicLinkCooldowns(storage)).toEqual({
      "builder@example.com": 1000,
    });
    expect(
      magicLinkCooldownRemaining(
        "builder@example.com",
        1000 + MAGIC_LINK_COOLDOWN_MS - 5000,
        storage,
      ),
    ).toBe(5000);
  });

  it("ignores blank emails", () => {
    const storage = memoryStorage();
    writeMagicLinkCooldown("   ", 1000, storage);

    expect(storage.getItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY)).toBeNull();
    expect(magicLinkCooldownRemaining("", 1000, storage)).toBe(0);
  });

  it("formats seconds for cooldown buttons", () => {
    expect(formatCooldown(1)).toBe("1s");
    expect(formatCooldown(2500)).toBe("3s");
  });
});
