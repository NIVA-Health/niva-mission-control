import "server-only";

/**
 * Identity-Aware Proxy puts the authenticated user in this header, prefixed
 * with the identity provider — e.g. "accounts.google.com:jane@nivahealth.com".
 *
 * NOTE ON TRUST: the service is deployed with --no-allow-unauthenticated and
 * fronted by IAP, so requests cannot reach it without passing through IAP. For
 * defence in depth you can additionally verify the signed JWT in
 * `x-goog-iap-jwt-assertion` against Google's public keys; that is the
 * hardening step if this app ever holds anything more sensitive than a
 * view preference.
 */
const IAP_EMAIL_HEADER = "x-goog-authenticated-user-email";

/** Authenticated user's email, or null when unauthenticated. */
export function getUserEmail(headers: Headers): string | null {
  const raw = headers.get(IAP_EMAIL_HEADER);
  if (!raw) {
    // Local development convenience: no IAP in front of `npm run dev`.
    return process.env.DEV_USER_EMAIL?.toLowerCase() ?? null;
  }
  const separator = raw.indexOf(":");
  const email = separator >= 0 ? raw.slice(separator + 1) : raw;
  return email.trim().toLowerCase() || null;
}

/** Accounts permitted to hide/restore cards for everyone. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null): boolean {
  if (!email) return false;
  const admins = adminEmails();
  // Fail closed: with no ADMIN_EMAILS configured, nobody can hide anything.
  return admins.length > 0 && admins.includes(email);
}
