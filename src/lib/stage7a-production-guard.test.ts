import { describe, expect, it } from "vitest";
import path from "node:path";
import { assertStage7aQaDatabase, productionDevDbPath, resolveSqliteFilePath } from "./stage7a-production-guard";

describe("stage7a production guard", () => {
  const cwd = process.cwd();

  it("resolves prisma-relative DATABASE_URL", () => {
    const resolved = resolveSqliteFilePath("file:./stage7a-qa.db", cwd);
    expect(resolved).toBe(path.normalize(path.join(cwd, "prisma", "stage7a-qa.db")));
  });

  it("refuses production dev.db", () => {
    const production = productionDevDbPath(cwd);
    expect(() => assertStage7aQaDatabase(`file:${production.replace(/\\/g, "/")}`, cwd)).toThrow(/refused/i);
  });

  it("allows dedicated QA db path", () => {
    const qa = path.join(cwd, "prisma", "stage7a-qa.db");
    expect(assertStage7aQaDatabase(`file:${qa.replace(/\\/g, "/")}`, cwd)).toBe(path.normalize(qa));
  });
});
