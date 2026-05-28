import { describe, expect, it } from "vitest";
import {
  authRedirectMessage,
  cleanAuthRedirectUrl,
  parseAuthRedirect,
  replaceAuthRedirectUrl,
} from "../src/auth-redirect";

describe("auth-redirect", () => {
  it("parses expired magic-link errors from the hash", () => {
    const redirect = parseAuthRedirect({
      origin: "https://cards.dpdns.org",
      pathname: "/",
      search: "",
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=",
    });

    expect(redirect).toMatchObject({
      kind: "error",
      source: "hash",
      error: "access_denied",
      errorCode: "otp_expired",
    });
    expect(authRedirectMessage(redirect)).toBe(
      "That magic link is invalid or expired. Request a new one.",
    );
  });

  it("detects session redirects without treating them as errors", () => {
    const redirect = parseAuthRedirect({
      origin: "https://cards.dpdns.org",
      pathname: "/",
      search: "?code=auth-code&type=magiclink",
      hash: "",
    });

    expect(redirect.kind).toBe("session");
    expect(authRedirectMessage(redirect)).toBe("");
  });

  it("cleans auth redirect params while preserving normal URL parts", () => {
    expect(
      cleanAuthRedirectUrl({
        origin: "https://cards.dpdns.org",
        pathname: "/builder/",
        search: "?theme=dark&code=auth-code&type=magiclink",
        hash: "#preview",
      }),
    ).toBe("https://cards.dpdns.org/builder/?theme=dark#preview");

    expect(
      cleanAuthRedirectUrl({
        origin: "https://cards.dpdns.org",
        pathname: "/",
        search: "?tab=shared",
        hash: "#error=access_denied&error_code=otp_expired&sb=",
      }),
    ).toBe("https://cards.dpdns.org/?tab=shared");
  });

  it("replaces the current URL only when auth params are present", () => {
    const replaced: string[] = [];
    const windowLike = {
      location: {
        origin: "https://cards.dpdns.org",
        pathname: "/",
        search: "",
        hash: "#error=access_denied&error_code=otp_expired",
      },
      history: {
        replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
          replaced.push(String(url || ""));
        },
      },
    };

    expect(replaceAuthRedirectUrl(windowLike)).toBe(true);
    expect(replaced).toEqual(["https://cards.dpdns.org/"]);

    expect(
      replaceAuthRedirectUrl({
        ...windowLike,
        location: { ...windowLike.location, hash: "#shared" },
      }),
    ).toBe(false);
  });
});
