import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const UNAUTHORIZED_BODY = { error: "Unauthorized" } as const;
const SERVER_ERROR_BODY = { error: "Internal server error" } as const;

/** Minimum MISSION_CONTROL_API_TOKEN size (UTF-8 bytes). */
export const MIN_API_TOKEN_BYTES = 32;

/** High-entropy server token required; never trim or transform the configured value. */
export function isValidServerToken(value: string | undefined): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (/^\s+$/.test(value)) {
    return false;
  }
  return Buffer.byteLength(value, "utf8") >= MIN_API_TOKEN_BYTES;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "misconfigured" };

/** Sanitized 401 — same body for missing, malformed, unsupported, or wrong credentials. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(UNAUTHORIZED_BODY, {
    status: 401,
    headers: {
      "WWW-Authenticate": "Bearer",
      "Cache-Control": "no-store",
    },
  });
}

/** Fail-closed when MISSION_CONTROL_API_TOKEN is absent or unusable. */
export function misconfiguredResponse(): NextResponse {
  return NextResponse.json(SERVER_ERROR_BODY, {
    status: 500,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Validates Authorization: Bearer <token> against MISSION_CONTROL_API_TOKEN.
 * Never accepts credentials from query parameters or cookies.
 * Does not log the supplied or expected token.
 */
export function authenticateBearer(request: Request): AuthResult {
  const expected = process.env.MISSION_CONTROL_API_TOKEN;
  if (!isValidServerToken(expected)) {
    return { ok: false, reason: "misconfigured" };
  }

  const header = request.headers.get("authorization");
  if (!header) {
    return { ok: false, reason: "unauthorized" };
  }

  // Exact shape: "Bearer <token>" (scheme case-insensitive per RFC 6750).
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) {
    return { ok: false, reason: "unauthorized" };
  }

  const supplied = match[1];
  const suppliedBuf = Buffer.from(supplied, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  // timingSafeEqual throws on length mismatch — check first so wrong-length
  // tokens return 401 without throwing.
  if (suppliedBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "unauthorized" };
  }

  if (!timingSafeEqual(suppliedBuf, expectedBuf)) {
    return { ok: false, reason: "unauthorized" };
  }

  return { ok: true };
}
