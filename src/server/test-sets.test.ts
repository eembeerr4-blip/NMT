import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  user: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/session", () => ({ getSessionUser: mock.user }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mock.transaction,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/audit-log", () => ({ recordAudit: vi.fn() }));

import { setTestPublication } from "./test-sets";

describe("test set publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.transaction.mockRejectedValue(new Error("stop before db"));
  });

  it("allows editors to change publication state", async () => {
    mock.user.mockResolvedValue({ id: "e2e_editor", role: "EDITOR" });
    const result = await setTestPublication("test-set", "PUBLISHED");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toMatch(/адміністратор/i);
    expect(mock.transaction).toHaveBeenCalled();
  });

  it("rejects students before touching storage", async () => {
    mock.user.mockResolvedValue({ id: "student", role: "STUDENT", subjects: [] });
    const result = await setTestPublication("test-set", "PUBLISHED");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/редактор|адміністратор|власник/i);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});
