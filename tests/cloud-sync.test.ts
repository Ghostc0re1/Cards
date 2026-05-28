import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCloudSync,
  deleteBuildShare,
  fetchCloudBuildRows,
  fetchSharedBuildRows,
  fetchUserProfile,
  magicLinkRedirectTo,
  publishBuildShare,
  refreshSession,
  saveUserProfile,
  signInWithMagicLink,
  signOut,
  upsertCloudBuildRows,
  verifyCloudSchema,
} from "../src/cloud-sync";
import { defaultState } from "../src/state-model";
import type {
  BuildShareRow,
  CloudBuildRow,
  CloudSyncClient,
  ProfileRow,
  SharedBuildRow,
  SupabaseConfig,
  SyncQueryResult,
  SyncSupabaseClient,
} from "../src/types";

const session = { user: { id: "user-1", email: "builder@example.com" } };

function cloudRow(): CloudBuildRow {
  return {
    id: "build-1",
    owner_id: "user-1",
    name: "Wendy",
    state_json: { ...defaultState(), title: "Wendy" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    shared_at: null,
  };
}

function clientWithTable(options: {
  selectResults?: Array<SyncQueryResult<CloudBuildRow>>;
  upsertResult?: SyncQueryResult<CloudBuildRow>;
  profileResult?: ProfileRow | null;
  sharedRows?: SharedBuildRow[];
  deletedShareIds?: string[];
  shareUpsertError?: { message?: string };
  deleteShareError?: { message?: string };
  tableErrors?: Record<string, { message?: string }>;
  onOtp?: (args: unknown) => void;
}): CloudSyncClient {
  const selectResults = [...(options.selectResults || [])];
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithOtp: async (args: unknown) => {
        options.onOtp?.(args);
        return { data: {}, error: null };
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      const tableError = options.tableErrors?.[table] || null;
      return ({
      select: () => ({
        order: async () =>
          tableError
            ? { data: null, error: tableError }
            :
          selectResults.shift() || {
            data: options.sharedRows || [],
            error: null,
          },
        eq: () => ({
          order: async () =>
            tableError
              ? { data: null, error: tableError }
              :
            selectResults.shift() || {
              data: options.sharedRows || [],
              error: null,
            },
          maybeSingle: async () => ({
            data: tableError ? null : options.profileResult || null,
            error: tableError,
          }),
          single: async () => ({
            data: tableError ? null : options.profileResult || null,
            error: tableError,
          }),
        }),
      }),
      upsert: (value: unknown) => {
        if (Array.isArray(value)) {
          return {
            select: async () =>
              options.upsertResult || { data: [], error: null },
          };
        }
        if (table === "build_shares") {
          return {
            select: () => ({
              single: async () => ({
                data: options.shareUpsertError ? null : (value as BuildShareRow),
                error: options.shareUpsertError || null,
              }),
            }),
          };
        }
        return {
          select: () => ({
            single: async () => ({
              data:
                options.profileResult ||
                ({
                  user_id: "user-1",
                  username: "builder",
                  username_key: "builder",
                  created_at: "2026-01-01T00:00:00.000Z",
                  updated_at: "2026-01-01T00:00:00.000Z",
                } satisfies ProfileRow),
              error: null,
            }),
          }),
        };
      },
      delete: () => ({
        eq: async (_column: string, value: unknown) => {
          if (options.deleteShareError) {
            return { data: null, error: options.deleteShareError };
          }
          options.deletedShareIds?.push(String(value));
          return { data: [], error: null };
        },
      }),
    });
    },
  } as unknown as SyncSupabaseClient;

  return { supabase, table: "builds", session };
}

describe("cloud-sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.__CARD_BUILDER_SUPABASE_CLIENT_FACTORY__;
  });

  it("throws a migration-needed message when deleted_at or shared_at is missing on fetch", async () => {
    const rowWithoutDeletedAt = cloudRow();
    const client = clientWithTable({
      selectResults: [
        { data: null, error: { message: "column shared_at does not exist" } },
        { data: [rowWithoutDeletedAt], error: null },
      ],
    });

    await expect(fetchCloudBuildRows(client)).rejects.toThrow(
      "Cloud schema needs deleted_at/shared_at migration. Run supabase/schema.sql.",
    );
  });

  it("throws a migration-needed message when deleted_at is rejected on upsert", async () => {
    const client = clientWithTable({
      upsertResult: {
        data: null,
        error: { message: "Could not find the deleted_at column" },
      },
    });

    await expect(upsertCloudBuildRows(client, [cloudRow()])).rejects.toThrow(
      "Cloud schema needs deleted_at/shared_at migration. Run supabase/schema.sql.",
    );
  });

  it("uses the current origin and path for magic-link redirects", async () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          origin: "https://cards.dpdns.org",
          pathname: "/builder/",
        },
      },
      configurable: true,
    });

    let otpArgs: unknown;
    const client = clientWithTable({
      onOtp: (args) => {
        otpArgs = args;
      },
    });

    expect(magicLinkRedirectTo()).toBe("https://cards.dpdns.org/builder/");
    await signInWithMagicLink(client, "builder@example.com");

    expect(otpArgs).toEqual({
      email: "builder@example.com",
      options: { emailRedirectTo: "https://cards.dpdns.org/builder/" },
    });

    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
    });
  });

  it("creates a sync client with the configured Supabase factory", async () => {
    globalThis.__CARD_BUILDER_SUPABASE_CLIENT_FACTORY__ = async (
      _config: SupabaseConfig,
    ) => clientWithTable({}).supabase;

    const client = await createCloudSync({
      enabled: true,
      url: "https://example.supabase.co",
      anonKey: "anon",
      table: "custom_builds",
    });

    expect(client.table).toBe("custom_builds");
    expect(client.session?.user?.id).toBe("user-1");
  });

  it("verifies the cloud schema when required tables and views are present", async () => {
    const client = clientWithTable({});

    await expect(verifyCloudSchema(client)).resolves.toEqual({
      ok: true,
      missing: [],
      message: "Cloud schema is ready.",
    });
  });

  it("reports missing v3 build columns during cloud schema preflight", async () => {
    const client = clientWithTable({
      tableErrors: {
        builds: { message: "column shared_at does not exist" },
      },
    });

    await expect(verifyCloudSchema(client)).resolves.toMatchObject({
      ok: false,
      missing: ["builds.shared_at/deleted_at"],
      message:
        "Cloud schema needs v3 migration (builds.shared_at/deleted_at). Run supabase/schema.sql before continuing.",
    });
  });

  it("reports missing profile and shared snapshot schema during preflight", async () => {
    const client = clientWithTable({
      tableErrors: {
        profiles: { message: "relation profiles does not exist" },
        build_shares: { message: "relation build_shares does not exist" },
        shared_builds: { message: "relation shared_builds does not exist" },
      },
    });

    await expect(verifyCloudSchema(client)).resolves.toEqual({
      ok: false,
      missing: ["profiles", "build_shares", "shared_builds"],
      message:
        "Cloud schema needs v3 migration (profiles, build_shares, shared_builds). Run supabase/schema.sql before continuing.",
    });
  });

  it("validates Supabase factory clients before using them", async () => {
    globalThis.__CARD_BUILDER_SUPABASE_CLIENT_FACTORY__ = async () =>
      ({ auth: {} }) as SyncSupabaseClient;

    await expect(
      createCloudSync({
        enabled: true,
        url: "https://example.supabase.co",
        anonKey: "anon",
      }),
    ).rejects.toThrow("Cloud sync is not configured yet.");
  });

  it("requires a signed-in session before reading or writing rows", async () => {
    const client = { ...clientWithTable({}), session: null };

    await expect(fetchCloudBuildRows(client)).rejects.toThrow(
      "Sign in before syncing builds.",
    );
    await expect(upsertCloudBuildRows(client, [cloudRow()])).rejects.toThrow(
      "Sign in before syncing builds.",
    );
  });

  it("returns an empty upsert result without touching Supabase", async () => {
    const client = clientWithTable({});

    await expect(upsertCloudBuildRows(client, [])).resolves.toEqual([]);
  });

  it("refreshes and clears sessions", async () => {
    const client = clientWithTable({});

    await expect(refreshSession(client)).resolves.toEqual(session);
    expect(client.session).toEqual(session);
    await expect(signOut(client)).resolves.toBeUndefined();
    expect(client.session).toBeNull();
  });

  it("throws auth errors from refresh and sign out", async () => {
    const authError = { message: "auth failed" };
    const supabase = {
      auth: {
        getSession: async () => ({ data: {}, error: authError }),
        signInWithOtp: async () => ({ data: {}, error: null }),
        signOut: async () => ({ error: authError }),
      },
      from: clientWithTable({}).supabase.from,
    } satisfies SyncSupabaseClient;
    const client: CloudSyncClient = { supabase, table: "builds", session };

    await expect(refreshSession(client)).rejects.toBe(authError);
    await expect(signOut(client)).rejects.toBe(authError);
  });

  it("loads and saves user profiles", async () => {
    const profile = {
      user_id: "user-1",
      username: "builder",
      username_key: "builder",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const client = clientWithTable({ profileResult: profile });

    await expect(fetchUserProfile(client, "user-1")).resolves.toMatchObject({
      username: "builder",
      usernameKey: "builder",
    });
    await expect(
      saveUserProfile(client, { userId: "user-1", username: "Builder" }),
    ).resolves.toMatchObject({ username: "builder" });
  });

  it("loads shared build rows", async () => {
    const sharedRow = {
      id: "shared-1",
      owner_id: "user-2",
      username: "other",
      hero_name: "Wendy",
      name: "Shared Wendy",
      state_json: { ...defaultState(), title: "Wendy" },
      updated_at: "2026-01-02T00:00:00.000Z",
      shared_at: "2026-01-03T00:00:00.000Z",
    };
    const client = clientWithTable({ sharedRows: [sharedRow] });

    await expect(fetchSharedBuildRows(client)).resolves.toEqual([sharedRow]);
  });

  it("publishes and deletes shared build snapshots", async () => {
    const deletedShareIds: string[] = [];
    const client = clientWithTable({ deletedShareIds });
    const shareRow = {
      id: "build-1",
      owner_id: "user-1",
      name: "Public Wendy",
      state_json: { ...defaultState(), title: "Wendy" },
      updated_at: "2026-01-04T00:00:00.000Z",
      shared_at: "2026-01-04T00:00:00.000Z",
    };

    await expect(publishBuildShare(client, shareRow)).resolves.toEqual(shareRow);
    await expect(deleteBuildShare(client, "build-1")).resolves.toBeUndefined();
    expect(deletedShareIds).toEqual(["build-1"]);
  });

  it("throws shared migration errors from delete failures", async () => {
    const client = clientWithTable({
      deleteShareError: { message: "relation build_shares does not exist" },
    });

    await expect(deleteBuildShare(client, "build-1")).rejects.toThrow(
      "Cloud schema needs build_shares/shared_builds migration. Run supabase/schema.sql.",
    );
  });

  it("throws a migration-needed message when build_shares is missing", async () => {
    const client = clientWithTable({
      shareUpsertError: { message: "relation build_shares does not exist" },
    });

    await expect(
      publishBuildShare(client, {
        id: "build-1",
        owner_id: "user-1",
        name: "Public Wendy",
        state_json: { ...defaultState(), title: "Wendy" },
        updated_at: "2026-01-04T00:00:00.000Z",
        shared_at: "2026-01-04T00:00:00.000Z",
      }),
    ).rejects.toThrow(
      "Cloud schema needs build_shares/shared_builds migration. Run supabase/schema.sql.",
    );
  });
});
