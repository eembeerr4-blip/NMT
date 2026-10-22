import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  user: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mock.prisma }));
vi.mock("@/server/session", () => ({ getSessionUser: mock.user, createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { moderateUserAccount } from "./actions";

describe("owner moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.user.mockResolvedValue({ id: "owner", firstName: "Власник", role: "ADMIN" });
    mock.prisma.$transaction.mockImplementation(async (handler: (tx: typeof mock.prisma) => Promise<unknown>) => handler(mock.prisma));
    mock.prisma.auditLog.create.mockResolvedValue({ id: "audit" });
  });

  it("approves only pending profiles", async () => {
    mock.prisma.user.findUnique.mockResolvedValue({ id: "learner", accountStatus: "PENDING", nickname: "learner" });
    expect((await moderateUserAccount("learner", "APPROVED")).ok).toBe(true);
    expect(mock.prisma.user.update).toHaveBeenCalledWith({ where: { id: "learner" }, data: { accountStatus: "APPROVED" } });
  });

  it("rejects repeat moderation", async () => {
    mock.prisma.user.findUnique.mockResolvedValue({ id: "learner", accountStatus: "APPROVED", nickname: "learner" });
    expect((await moderateUserAccount("learner", "REJECTED")).ok).toBe(false);
    expect(mock.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects administrators and editors", async () => {
    for (const role of ["ADMIN", "EDITOR"] as const) {
      mock.user.mockResolvedValue({ id: "staff", firstName: "Staff", role });
      expect((await moderateUserAccount("learner", "APPROVED")).ok).toBe(false);
    }
    expect(mock.prisma.user.update).not.toHaveBeenCalled();
  });
});
