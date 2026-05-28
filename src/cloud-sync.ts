import { createClient } from "@supabase/supabase-js";
import type {
  AuthSession,
  BuildShareRow,
  CloudSchemaStatus,
  CloudBuildRow,
  CloudSyncClient,
  ProfileRow,
  SharedBuildRow,
  SupabaseConfig,
  SyncSupabaseClient,
  UserProfile,
} from "./types";
import {
  profileRowToProfile,
  profileToRow,
} from "./shared-builds";

function missingClientError(): Error {
  return new Error("Cloud sync is not configured yet.");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isSyncSupabaseClient(value: unknown): value is SyncSupabaseClient {
  if (!isObject(value)) return false;
  const auth = value.auth;
  if (!isObject(auth)) return false;
  return (
    typeof value.from === "function" &&
    typeof auth.getSession === "function" &&
    typeof auth.signInWithOtp === "function" &&
    typeof auth.signOut === "function"
  );
}

function toSyncSupabaseClient(value: unknown): SyncSupabaseClient {
  if (!isSyncSupabaseClient(value)) throw missingClientError();
  return value;
}

function isMissingSharedSchemaError(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message || "")
      : "";
  return (
    message.includes("build_shares") ||
    message.includes("shared_builds") ||
    message.includes("shared_at") ||
    message.includes("deleted_at")
  );
}

function sharedSchemaMigrationError(): Error {
  return new Error(
    "Cloud schema needs build_shares/shared_builds migration. Run supabase/schema.sql.",
  );
}

function cloudSchemaMessage(missing: string[]): string {
  return missing.length
    ? `Cloud schema needs v3 migration (${missing.join(", ")}). Run supabase/schema.sql before continuing.`
    : "Cloud schema is ready.";
}

function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message || "")
    : String(error || "");
}

function missingSchemaName(name: string, error: unknown): string {
  const message = errorMessage(error);
  if (message.includes("build_shares")) return "build_shares";
  if (message.includes("shared_builds")) return "shared_builds";
  if (message.includes("profiles")) return "profiles";
  if (message.includes("deleted_at") || message.includes("shared_at")) {
    return name === "builds" ? "builds.shared_at/deleted_at" : name;
  }
  return name;
}

async function createSupabaseClient(
  config: SupabaseConfig,
): Promise<SyncSupabaseClient> {
  if (!config?.url || !config?.anonKey) throw missingClientError();

  if (globalThis.__CARD_BUILDER_SUPABASE_CLIENT_FACTORY__) {
    return toSyncSupabaseClient(
      await globalThis.__CARD_BUILDER_SUPABASE_CLIENT_FACTORY__(config),
    );
  }

  return toSyncSupabaseClient(createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  }));
}

export async function createCloudSync(
  config: SupabaseConfig,
  onAuthChange: (session: AuthSession | null) => void = () => {},
): Promise<CloudSyncClient> {
  const supabase = await createSupabaseClient(config);
  const table = config.table || "builds";
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data?.session || null;

  supabase.auth.onAuthStateChange?.((_event, nextSession) => {
    onAuthChange(nextSession || null);
  });

  return { supabase, table, session };
}

export async function refreshSession(
  client: CloudSyncClient | null | undefined,
): Promise<AuthSession | null> {
  if (!client?.supabase) throw missingClientError();
  const result = await client.supabase.auth.getSession();
  if (result.error) throw result.error;
  client.session = result.data?.session || null;
  return client.session;
}

export async function verifyCloudSchema(
  client: CloudSyncClient | null | undefined,
): Promise<CloudSchemaStatus> {
  if (!client?.session) {
    return {
      ok: false,
      missing: ["session"],
      message: "Sign in before checking the cloud schema.",
    };
  }

  const ownerId = client.session.user?.id || "";
  const checks: Array<{
    name: string;
    query: () => Promise<{ error?: unknown }>;
  }> = [
    {
      name: "builds",
      query: () =>
        client.supabase
          .from<CloudBuildRow>(client.table)
          .select("id,name,state_json,created_at,updated_at,deleted_at,shared_at")
          .eq("owner_id", ownerId)
          .order("updated_at", { ascending: false }),
    },
    {
      name: "profiles",
      query: () =>
        client.supabase
          .from<ProfileRow>("profiles")
          .select("user_id,username,username_key,created_at,updated_at")
          .eq("user_id", ownerId)
          .maybeSingle(),
    },
    {
      name: "build_shares",
      query: () =>
        client.supabase
          .from<BuildShareRow>("build_shares")
          .select("id,owner_id,name,state_json,updated_at,shared_at")
          .eq("owner_id", ownerId)
          .order("shared_at", { ascending: false }),
    },
    {
      name: "shared_builds",
      query: () =>
        client.supabase
          .from<SharedBuildRow>("shared_builds")
          .select("id,owner_id,username,hero_name,name,state_json,updated_at,shared_at")
          .order("shared_at", { ascending: false }),
    },
  ];

  const missing = new Set<string>();
  for (const check of checks) {
    try {
      const result = await check.query();
      if (result.error) missing.add(missingSchemaName(check.name, result.error));
    } catch (error) {
      missing.add(missingSchemaName(check.name, error));
    }
  }

  const missingList = Array.from(missing);
  return missingList.length
    ? { ok: false, missing: missingList, message: cloudSchemaMessage(missingList) }
    : { ok: true, missing: [], message: cloudSchemaMessage([]) };
}

export function magicLinkRedirectTo(): string {
  const location = globalThis.window?.location || globalThis.location;
  return `${location.origin}${location.pathname}`;
}

export async function signInWithMagicLink(
  client: CloudSyncClient | null | undefined,
  email: string,
): Promise<void> {
  if (!client?.supabase) throw missingClientError();
  const result = await client.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: magicLinkRedirectTo() },
  });
  if (result.error) throw result.error;
}

export async function signOut(
  client: CloudSyncClient | null | undefined,
): Promise<void> {
  if (!client?.supabase) throw missingClientError();
  const result = await client.supabase.auth.signOut();
  if (result.error) throw result.error;
  client.session = null;
}

export async function fetchCloudBuildRows(
  client: CloudSyncClient | null | undefined,
): Promise<CloudBuildRow[]> {
  if (!client?.session) throw new Error("Sign in before syncing builds.");
  let result = await client.supabase
    .from<CloudBuildRow>(client.table)
    .select("id,name,state_json,created_at,updated_at,deleted_at,shared_at")
    .eq("owner_id", client.session.user?.id || "")
    .order("updated_at", { ascending: false });
  if (
    result.error &&
    (String(result.error.message || "").includes("deleted_at") ||
      String(result.error.message || "").includes("shared_at"))
  ) {
    throw new Error("Cloud schema needs deleted_at/shared_at migration. Run supabase/schema.sql.");
  }
  if (result.error) throw result.error;
  return result.data || [];
}

export async function upsertCloudBuildRows(
  client: CloudSyncClient | null | undefined,
  rows: CloudBuildRow[],
): Promise<CloudBuildRow[]> {
  if (!client?.session) throw new Error("Sign in before syncing builds.");
  if (!rows.length) return [];
  const result = await client.supabase
    .from<CloudBuildRow>(client.table)
    .upsert(rows, { onConflict: "id" })
    .select("id,name,state_json,created_at,updated_at,deleted_at,shared_at");
  if (
    result.error &&
    (String(result.error.message || "").includes("deleted_at") ||
      String(result.error.message || "").includes("shared_at"))
  ) {
    throw new Error("Cloud schema needs deleted_at/shared_at migration. Run supabase/schema.sql.");
  }
  if (result.error) throw result.error;
  return result.data || [];
}

export async function fetchUserProfile(
  client: CloudSyncClient | null | undefined,
  userId: string,
): Promise<UserProfile | null> {
  if (!client?.session) throw new Error("Sign in before loading your profile.");
  const result = await client.supabase
    .from<ProfileRow>("profiles")
    .select("user_id,username,username_key,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return profileRowToProfile(result.data as ProfileRow | null | undefined);
}

export async function saveUserProfile(
  client: CloudSyncClient | null | undefined,
  profile: { userId: string; username: string },
): Promise<UserProfile> {
  if (!client?.session) throw new Error("Sign in before saving your profile.");
  const result = await client.supabase
    .from<ProfileRow>("profiles")
    .upsert(profileToRow(profile), { onConflict: "user_id" })
    .select("user_id,username,username_key,created_at,updated_at")
    .single();
  if (result.error) throw result.error;
  const saved = profileRowToProfile(result.data as ProfileRow | null | undefined);
  if (!saved) throw new Error("Unable to save username.");
  return saved;
}

export async function fetchSharedBuildRows(
  client: CloudSyncClient | null | undefined,
): Promise<SharedBuildRow[]> {
  if (!client?.session) return [];
  const result = await client.supabase
    .from<SharedBuildRow>("shared_builds")
    .select("id,owner_id,username,hero_name,name,state_json,updated_at,shared_at")
    .order("shared_at", { ascending: false });
  if (result.error && isMissingSharedSchemaError(result.error)) {
    throw sharedSchemaMigrationError();
  }
  if (result.error) throw result.error;
  return result.data || [];
}

export async function publishBuildShare(
  client: CloudSyncClient | null | undefined,
  row: BuildShareRow,
): Promise<BuildShareRow> {
  if (!client?.session) throw new Error("Sign in before publishing builds.");
  const result = await client.supabase
    .from<BuildShareRow>("build_shares")
    .upsert(row, { onConflict: "id" })
    .select("id,owner_id,name,state_json,updated_at,shared_at")
    .single();
  if (result.error && isMissingSharedSchemaError(result.error)) {
    throw sharedSchemaMigrationError();
  }
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Unable to publish build.");
  return result.data;
}

export async function deleteBuildShare(
  client: CloudSyncClient | null | undefined,
  buildId: string,
): Promise<void> {
  if (!client?.session) throw new Error("Sign in before unpublishing builds.");
  const result = await client.supabase
    .from<BuildShareRow>("build_shares")
    .delete()
    .eq("id", buildId);
  if (result.error && isMissingSharedSchemaError(result.error)) {
    throw sharedSchemaMigrationError();
  }
  if (result.error) throw result.error;
}
