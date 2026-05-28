import type { SupabaseConfig } from "./types";

export const SUPABASE_CONFIG = {
  enabled: true,
  url: "https://zdqxoaopwyzbtivweehr.supabase.co",
  anonKey: "sb_publishable_ylKLG5ILjfIw9r3ADX-dCA_ZG15Bw-g",
  table: "builds",
} satisfies Required<SupabaseConfig>;

export function getSupabaseConfig(): SupabaseConfig {
  const runtimeConfig = globalThis.CARD_BUILDER_SUPABASE || {};
  const url =
    runtimeConfig.url ||
    globalThis.CARD_BUILDER_SUPABASE_URL ||
    SUPABASE_CONFIG.url;
  const anonKey =
    runtimeConfig.anonKey ||
    globalThis.CARD_BUILDER_SUPABASE_ANON_KEY ||
    SUPABASE_CONFIG.anonKey;
  const table = runtimeConfig.table || SUPABASE_CONFIG.table;
  const enabled =
    runtimeConfig.enabled ?? SUPABASE_CONFIG.enabled ?? Boolean(url && anonKey);

  return { enabled, url, anonKey, table };
}

export function isSupabaseConfigured(
  config: SupabaseConfig = getSupabaseConfig(),
): boolean {
  return Boolean(config.enabled && config.url && config.anonKey);
}
