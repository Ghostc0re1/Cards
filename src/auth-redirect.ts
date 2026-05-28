type AuthRedirectSource = "hash" | "search";

export interface AuthRedirectState {
  kind: "none" | "error" | "session";
  source: AuthRedirectSource | null;
  error: string;
  errorCode: string;
  description: string;
}

interface LocationLike {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
}

interface HistoryLike {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

interface WindowLike {
  location: LocationLike;
  history?: HistoryLike;
}

const AUTH_PARAM_NAMES = new Set([
  "access_token",
  "code",
  "error",
  "error_code",
  "error_description",
  "expires_at",
  "expires_in",
  "refresh_token",
  "sb",
  "token_type",
  "type",
]);

function parseParams(value: string): URLSearchParams {
  return new URLSearchParams(value.replace(/^[?#]/, ""));
}

function hasAuthParams(params: URLSearchParams): boolean {
  return Array.from(params.keys()).some((key) => AUTH_PARAM_NAMES.has(key));
}

function redirectStateFromParams(
  params: URLSearchParams,
  source: AuthRedirectSource,
): AuthRedirectState {
  const error = params.get("error") || "";
  const errorCode = params.get("error_code") || "";
  const description = params.get("error_description") || "";
  if (error || errorCode || description) {
    return {
      kind: "error",
      source,
      error,
      errorCode,
      description,
    };
  }
  return {
    kind: "session",
    source,
    error: "",
    errorCode: "",
    description: "",
  };
}

export function parseAuthRedirect(
  location: LocationLike = globalThis.window.location,
): AuthRedirectState {
  const hashParams = parseParams(location.hash);
  if (hasAuthParams(hashParams)) return redirectStateFromParams(hashParams, "hash");

  const searchParams = parseParams(location.search);
  if (hasAuthParams(searchParams)) {
    return redirectStateFromParams(searchParams, "search");
  }

  return {
    kind: "none",
    source: null,
    error: "",
    errorCode: "",
    description: "",
  };
}

function paramsWithoutAuthParams(value: string): string {
  const params = parseParams(value);
  for (const key of AUTH_PARAM_NAMES) params.delete(key);
  return params.toString();
}

export function cleanAuthRedirectUrl(
  location: LocationLike = globalThis.window.location,
): string {
  const cleanSearch = paramsWithoutAuthParams(location.search);
  const hashParams = parseParams(location.hash);
  const cleanHash = hasAuthParams(hashParams) ? "" : location.hash;
  return `${location.origin}${location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${cleanHash}`;
}

export function replaceAuthRedirectUrl(
  windowLike: WindowLike = globalThis.window,
): boolean {
  const redirect = parseAuthRedirect(windowLike.location);
  if (redirect.kind === "none" || !windowLike.history) return false;
  windowLike.history.replaceState(null, "", cleanAuthRedirectUrl(windowLike.location));
  return true;
}

export function authRedirectMessage(redirect: AuthRedirectState): string {
  if (redirect.kind !== "error") return "";
  const code = redirect.errorCode.toLowerCase();
  const description = redirect.description.toLowerCase();
  if (
    code === "otp_expired" ||
    description.includes("expired") ||
    description.includes("invalid")
  ) {
    return "That magic link is invalid or expired. Request a new one.";
  }
  return "That sign-in link could not be used. Request a new magic link.";
}
