import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  user: vi.fn(),
  findMany: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/audit-log", () => ({recordAudit: mock.audit}));
vi.mock("@/server/session", () => ({ getSessionUser: mock.user }));
vi.mock("@/lib/prisma", () => ({ prisma: { question: { findMany: mock.findMany } } }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("question bank export access", () => {
  it("requires an authenticated account", async () => {
    mock.user.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mock.findMany).not.toHaveBeenCalled();
  });

  it("denies a student before reading answer data", async () => {
    mock.user.mockResolvedValue({ id: "student", role: "STUDENT" });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mock.audit).not.toHaveBeenCalled();
    expect(mock.findMany).not.toHaveBeenCalled();
  });

  it("allows a content editor to use the existing export", async () => {
    mock.user.mockResolvedValue({ id: "editor", role: "EDITOR" });
    mock.findMany.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({id:"editor"}), expect.objectContaining({action:"QUESTIONS_EXPORTED",metadata:{count:0}}));
    expect(mock.findMany).toHaveBeenCalledWith({ include: { options: true }, orderBy: { createdAt: "asc" } });
  });
});
