// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      set: mockSet,
      get: mockGet,
      delete: mockDelete,
    })
  ),
}));

vi.mock("server-only", () => ({}));

import { createSession, getSession, deleteSession } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an httpOnly cookie", async () => {
  await createSession("user-123", "test@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [name, _token, options] = mockSet.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.path).toBe("/");
  expect(options.sameSite).toBe("lax");
});

test("createSession cookie expires in ~7 days", async () => {
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, , options] = mockSet.mock.calls[0];
  const expires: Date = options.expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession stores a valid JWT that getSession can decode", async () => {
  await createSession("user-123", "test@example.com");

  const [, token] = mockSet.mock.calls[0];

  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("test@example.com");
});

test("getSession returns null when cookie is absent", async () => {
  mockGet.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a tampered token", async () => {
  mockGet.mockReturnValue({ value: "invalid.token.value" });

  const session = await getSession();
  expect(session).toBeNull();
});

test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockDelete).toHaveBeenCalledOnce();
  expect(mockDelete).toHaveBeenCalledWith("auth-token");
});

test("getSession returns all payload fields", async () => {
  await createSession("user-456", "fields@example.com");
  const [, token] = mockSet.mock.calls[0];
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-456");
  expect(session?.email).toBe("fields@example.com");
  expect(session?.expiresAt).toBeDefined();
});

test("getSession returns null for an expired token", async () => {
  const secret = new TextEncoder().encode("development-secret-key");
  const expiredToken = await new SignJWT({ userId: "user-789", email: "exp@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("-1s")
    .setIssuedAt()
    .sign(secret);

  mockGet.mockReturnValue({ value: expiredToken });

  const session = await getSession();
  expect(session).toBeNull();
});
