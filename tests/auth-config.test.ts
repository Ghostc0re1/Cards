import { afterEach, describe, expect, it } from "vitest";
import {
  isMagicLinkRateLimitError,
  magicLinkErrorMessage,
  rateLimitCode,
} from "../src/auth-errors";
import {
  getSupabaseConfig,
  isSupabaseConfigured,
} from "../src/supabase-config";

describe("auth and Supabase config", () => {
  afterEach(() => {
    delete globalThis.CARD_BUILDER_SUPABASE;
    delete globalThis.CARD_BUILDER_SUPABASE_URL;
    delete globalThis.CARD_BUILDER_SUPABASE_ANON_KEY;
  });

  it("reads Supabase config from runtime globals", () => {
    globalThis.CARD_BUILDER_SUPABASE = {
      enabled: true,
      url: "https://runtime.supabase.co",
      anonKey: "runtime-anon",
      table: "runtime_builds",
    };

    expect(getSupabaseConfig()).toEqual({
      enabled: true,
      url: "https://runtime.supabase.co",
      anonKey: "runtime-anon",
      table: "runtime_builds",
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("falls back to URL and anon key globals when no config object is present", () => {
    globalThis.CARD_BUILDER_SUPABASE_URL = "https://env.supabase.co";
    globalThis.CARD_BUILDER_SUPABASE_ANON_KEY = "env-anon";

    expect(getSupabaseConfig()).toEqual(
      expect.objectContaining({
        enabled: true,
        url: "https://env.supabase.co",
        anonKey: "env-anon",
        table: "builds",
      }),
    );
  });

  it("rejects disabled or incomplete Supabase config", () => {
    expect(isSupabaseConfigured({ enabled: false, url: "x", anonKey: "y" })).toBe(
      false,
    );
    expect(isSupabaseConfigured({ enabled: true, url: "x" })).toBe(false);
    expect(isSupabaseConfigured({ enabled: true, anonKey: "y" })).toBe(false);
  });

  it("maps rate-limit auth errors", () => {
    const error = {
      status: 429,
      error_code: "over_request_rate_limit",
      message: "too many requests",
    };

    expect(rateLimitCode(error)).toBe("over_request_rate_limit");
    expect(isMagicLinkRateLimitError(error)).toBe(true);
    expect(magicLinkErrorMessage(error)).toBe(
      "Too many sign-in requests. Try again in a few minutes.",
    );
    expect(
      magicLinkErrorMessage({ code: "over_email_send_rate_limit" }),
    ).toBe("Please wait before requesting another link.");
  });

  it("maps network, delivery, and unknown auth errors", () => {
    expect(magicLinkErrorMessage({ message: "Failed to fetch" })).toContain(
      "blocked by the browser or network",
    );
    expect(magicLinkErrorMessage({ status: 500, message: "SMTP failed" })).toBe(
      "Email delivery failed in Supabase Auth. Check Auth logs and Brevo SMTP security.",
    );
    expect(magicLinkErrorMessage({ message: "Bad email" })).toBe(
      "Sign in failed: Bad email",
    );
    expect(magicLinkErrorMessage(null)).toBe(
      "Sign in failed: Unable to send magic link.",
    );
  });
});
