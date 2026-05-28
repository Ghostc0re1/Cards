import type { SyncError } from "./types";

function errorRecord(error: unknown): SyncError {
  return error && typeof error === "object" ? (error as SyncError) : {};
}

export function rateLimitCode(error: unknown): string {
  const source = errorRecord(error);
  return String(source.code || source.error_code || "").toLowerCase();
}

export function isMagicLinkRateLimitError(error: unknown): boolean {
  const source = errorRecord(error);
  const code = rateLimitCode(error);
  const message = String(source.message || "").toLowerCase();
  return (
    source.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

function isNetworkBlockedError(error: unknown): boolean {
  const message = String(errorRecord(error).message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network access") ||
    message.includes("err_blocked_by_client") ||
    message.includes("blocked by client")
  );
}

function isAuthDeliveryError(error: unknown): boolean {
  const source = errorRecord(error);
  const code = rateLimitCode(error);
  const message = String(source.message || "").toLowerCase();
  return (
    Number(source.status || 0) >= 500 ||
    code === "unexpected_failure" ||
    message.includes("confirmation email") ||
    message.includes("smtp") ||
    message.includes("email delivery")
  );
}

export function magicLinkErrorMessage(error: unknown): string {
  const source = errorRecord(error);
  if (isNetworkBlockedError(error)) {
    return "Sign-in request was blocked by the browser or network. Check privacy/ad-block settings and try again.";
  }
  if (!isMagicLinkRateLimitError(error)) {
    if (isAuthDeliveryError(error)) {
      return "Email delivery failed in Supabase Auth. Check Auth logs and Brevo SMTP security.";
    }
    return `Sign in failed: ${source.message || "Unable to send magic link."}`;
  }
  const code = rateLimitCode(error);
  if (code === "over_email_send_rate_limit") {
    return "Please wait before requesting another link.";
  }
  return "Too many sign-in requests. Try again in a few minutes.";
}
