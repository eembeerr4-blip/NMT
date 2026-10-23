import { describe, expect, it } from "vitest";
import { adminNavActive } from "./admin-nav";

const hrefs = [
  "/admin",
  "/admin/moderation",
  "/admin/users",
  "/admin/subjects",
  "/admin/topics",
  "/admin/lessons",
  "/admin/questions",
  "/admin/tasks",
  "/admin/tests",
  "/admin/settings",
  "/admin/audit",
];

describe("adminNavActive", () => {
  it("highlights only overview on /admin", () => {
    expect(adminNavActive("/admin", "/admin", hrefs)).toBe(true);
    expect(adminNavActive("/admin", "/admin/moderation", hrefs)).toBe(false);
    expect(adminNavActive("/admin", "/admin/audit", hrefs)).toBe(false);
  });

  it("highlights only moderation on /admin/moderation", () => {
    expect(adminNavActive("/admin/moderation", "/admin/moderation", hrefs)).toBe(true);
    expect(adminNavActive("/admin/moderation", "/admin/audit", hrefs)).toBe(false);
    expect(adminNavActive("/admin/moderation", "/admin", hrefs)).toBe(false);
  });

  it("highlights only audit on /admin/audit", () => {
    expect(adminNavActive("/admin/audit", "/admin/audit", hrefs)).toBe(true);
    expect(adminNavActive("/admin/audit", "/admin/moderation", hrefs)).toBe(false);
  });
});
