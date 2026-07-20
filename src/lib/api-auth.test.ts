import { afterEach, describe, expect, it } from "vitest";
import {
  authenticateBearer,
  isValidServerToken,
  misconfiguredResponse,
  unauthorizedResponse,
} from "@/lib/api-auth";

const TOKEN = "test-token-abcdefghijklmnopqrstuvwxyz12";

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost/api/v1/delivery", { headers });
}

describe("isValidServerToken", () => {
  it("rejects missing, empty, whitespace-only, and short tokens", () => {
    expect(isValidServerToken(undefined)).toBe(false);
    expect(isValidServerToken("")).toBe(false);
    expect(isValidServerToken("   ")).toBe(false);
    expect(isValidServerToken("a".repeat(31))).toBe(false);
  });

  it("accepts tokens with at least 32 UTF-8 bytes without trimming", () => {
    const token32 = "a".repeat(32);
    expect(isValidServerToken(token32)).toBe(true);
    expect(Buffer.byteLength(token32, "utf8")).toBe(32);

    const multibyte31 = "é".repeat(31);
    expect(Buffer.byteLength(multibyte31, "utf8")).toBe(62);
    expect(isValidServerToken(multibyte31)).toBe(true);

    const multibyteShort = "é".repeat(15);
    expect(Buffer.byteLength(multibyteShort, "utf8")).toBe(30);
    expect(isValidServerToken(multibyteShort)).toBe(false);
  });
});

describe("authenticateBearer", () => {
  afterEach(() => {
    delete process.env.MISSION_CONTROL_API_TOKEN;
  });

  it("returns unauthorized when Authorization header is missing", () => {
    process.env.MISSION_CONTROL_API_TOKEN = TOKEN;
    expect(authenticateBearer(requestWithAuth())).toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("returns unauthorized when Authorization header is malformed", () => {
    process.env.MISSION_CONTROL_API_TOKEN = TOKEN;
    expect(authenticateBearer(requestWithAuth("Bearer"))).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(authenticateBearer(requestWithAuth("Bearer "))).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(authenticateBearer(requestWithAuth(`Basic ${TOKEN}`))).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(authenticateBearer(requestWithAuth(`Token ${TOKEN}`))).toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("returns unauthorized for a wrong token of the same length", () => {
    process.env.MISSION_CONTROL_API_TOKEN = TOKEN;
    const wrong = "x".repeat(TOKEN.length);
    expect(authenticateBearer(requestWithAuth(`Bearer ${wrong}`))).toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("returns unauthorized for a wrong token of a different length without throwing", () => {
    process.env.MISSION_CONTROL_API_TOKEN = TOKEN;
    expect(() =>
      authenticateBearer(requestWithAuth("Bearer short")),
    ).not.toThrow();
    expect(authenticateBearer(requestWithAuth("Bearer short"))).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(
      authenticateBearer(requestWithAuth(`Bearer ${TOKEN}extra`)),
    ).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("returns ok for the correct token", () => {
    process.env.MISSION_CONTROL_API_TOKEN = TOKEN;
    expect(authenticateBearer(requestWithAuth(`Bearer ${TOKEN}`))).toEqual({
      ok: true,
    });
  });

  it("fails closed when the server token is missing", () => {
    delete process.env.MISSION_CONTROL_API_TOKEN;
    expect(authenticateBearer(requestWithAuth(`Bearer ${TOKEN}`))).toEqual({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("fails closed when the server token is empty", () => {
    process.env.MISSION_CONTROL_API_TOKEN = "";
    expect(authenticateBearer(requestWithAuth(`Bearer ${TOKEN}`))).toEqual({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("fails closed when the server token is whitespace-only", () => {
    process.env.MISSION_CONTROL_API_TOKEN = "   \t\n  ";
    expect(authenticateBearer(requestWithAuth(`Bearer ${TOKEN}`))).toEqual({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("fails closed when the server token is shorter than 32 UTF-8 bytes", () => {
    process.env.MISSION_CONTROL_API_TOKEN = "a".repeat(31);
    expect(authenticateBearer(requestWithAuth(`Bearer ${TOKEN}`))).toEqual({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("accepts a valid 32-byte server token", () => {
    const token32 = "b".repeat(32);
    process.env.MISSION_CONTROL_API_TOKEN = token32;
    expect(authenticateBearer(requestWithAuth(`Bearer ${token32}`))).toEqual({
      ok: true,
    });
  });
});

describe("auth responses", () => {
  it("unauthorized response is sanitized 401 with WWW-Authenticate and no-store", () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("misconfigured response is sanitized 500 with no-store", () => {
    const res = misconfiguredResponse();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
