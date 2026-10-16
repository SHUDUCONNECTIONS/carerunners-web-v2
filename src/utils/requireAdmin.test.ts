import { describe, it, expect, vi } from "vitest";

vi.mock("@/utils/firebaseAdmin", () => ({ adminAuth: vi.fn() }));

import { isAdminUser } from "./requireAdmin";
import { LEGACY_ADMIN_EMAILS as ADMIN_EMAILS } from "./adminEmails";

describe("isAdminUser", () => {
  const adminEmail = ADMIN_EMAILS[0];

  it("accepts a verified admin email", () => {
    expect(isAdminUser({ uid: "a", email: adminEmail, emailVerified: true })).toBe(true);
  });

  it("ignores letter case in the email", () => {
    expect(isAdminUser({ uid: "a", email: adminEmail.toUpperCase(), emailVerified: true })).toBe(true);
  });

  it("rejects an admin email that has not been verified", () => {
    // Someone signing up with email + password using an admin's address that has no account yet.
    expect(isAdminUser({ uid: "a", email: adminEmail, emailVerified: false })).toBe(false);
  });

  it("accepts any account with the admin flag", () => {
    expect(isAdminUser({ uid: "a", email: "someone@example.com", emailVerified: false, admin: true })).toBe(true);
  });

  it("rejects other emails and signed-out callers", () => {
    expect(isAdminUser({ uid: "a", email: "someone@example.com", emailVerified: true })).toBe(false);
    expect(isAdminUser({ uid: "a", email: null, emailVerified: true })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});
