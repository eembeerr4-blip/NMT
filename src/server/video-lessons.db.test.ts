import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const auth = vi.hoisted(() => ({ user: { id: "qa-owner", role: "OWNER", accountStatus: "APPROVED" } as { id: string; role: string; accountStatus: string } | null }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const folder = mkdtempSync(path.join(tmpdir(), "nmt-video-actions-"));
  const database = path.join(folder, "qa.db");
  const clients = [0, 1].map(() => new PrismaClient({ datasourceUrl: "file:" + database.replaceAll("\\", "/") + "?connection_limit=1" }));
  const context = new AsyncLocalStorage<typeof clients[number]>();
  const prisma = new Proxy(clients[0], { get(_target, key) {
    const client = context.getStore() ?? clients[0];
    const value = Reflect.get(client, key);
    return typeof value === "function" ? value.bind(client) : value;
  } });
  return { prisma, clients, folder, database, withClient: <T>(index: number, run: () => T) => context.run(clients[index], run) };
});
vi.mock("@/server/session", () => ({ getSessionUser: () => auth.user, createSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { addVideo, updateVideo, makePrimary, setVideoReview, setVideoRole, deleteVideo, saveVideoNotes, saveVideoPosition } from "./actions";
import { VideoPanel } from "@/components/video-panel";
import { addVideoCandidate } from "./video-lessons";
import { recordAudit } from "./audit-log";
const fixtureModule = () => import("@/lib/prisma") as unknown as Promise<{ database: string; folder: string; clients: typeof prisma[]; withClient: <T>(index: number, run: () => T) => T }>;
const ids = ["abcdefghijk", "lmnopqrstuv", "12345678901"];
const url = (index: number) => "https://youtu.be/" + ids[index];
const add = async (index = 0) => {
  const result = await addVideo("qa-topic", url(index), "QA video " + index);
  expect(result.ok).toBe(true);
  if (!result.ok || !result.id) throw new Error("Missing fixture video");
  return result.id;
};
const snapshot = async () => ({ videos: await prisma.videoLesson.findMany({ orderBy: { id: "asc" } }), progress: await prisma.userVideoProgress.findMany(), audit: await prisma.auditLog.findMany(), topic: await prisma.topic.findMany() });
const primary = () => prisma.videoLesson.findMany({ where: { topicId: "qa-topic", isPrimary: true } });

beforeAll(async () => {
  const { database, clients } = await fixtureModule();
  const sql = new DatabaseSync(database);
  const source = readFileSync("prisma/migrations/20261018000000_reconcile_history/migration.sql", "utf8");
  const normalized = readFileSync("prisma/migrations/20261018000100_normalize_user_video_progress/migration.sql", "utf8");
  const table = (text: string, name: string) => {
    const start = text.indexOf('CREATE TABLE "' + name + '" (');
    if (start < 0) throw new Error("Missing fixture definition " + name);
    const end = text.indexOf(");", start) + 2;
    return text.slice(start, end).replace('"' + name + '"', '"' + name.replace("new_", "") + '"');
  };
  // Only empty fixture CREATE definitions, never migrate/db push or the working DATABASE_URL.
  sql.exec('PRAGMA foreign_keys=ON; CREATE TABLE "User" (id TEXT PRIMARY KEY); CREATE TABLE "Subject" (id TEXT PRIMARY KEY);');
  for (const name of ["new_Topic", "new_VideoLesson", "AuditLog"]) sql.exec(table(source, name));
  sql.exec(table(normalized, "new_UserVideoProgress"));
  sql.exec('CREATE UNIQUE INDEX progress_identity ON UserVideoProgress(userId,videoId);');
  sql.exec("INSERT INTO User VALUES ('qa-owner'),('qa-student'); INSERT INTO Subject VALUES ('qa-subject');");
  sql.close();
  for (const client of clients) {
    await client.$queryRawUnsafe("PRAGMA journal_mode=WAL");
    await client.$queryRawUnsafe("PRAGMA busy_timeout=5000");
  }
});
beforeEach(async () => {
  auth.user = { id: "qa-owner", role: "OWNER", accountStatus: "APPROVED" };
  await prisma.userVideoProgress.deleteMany(); await prisma.videoLesson.deleteMany(); await prisma.auditLog.deleteMany(); await prisma.topic.deleteMany();
  await prisma.topic.create({ data: { id: "qa-topic", subjectId: "qa-subject", title: "QA", sortOrder: 0, coverage: "DRAFT", status: "NOT_STARTED", lessonJson: "unchanged QA theory" } });
});
afterAll(async () => {
  const { folder, clients } = await fixtureModule();
  await Promise.all(clients.map(client => client.$disconnect()));
  if (!path.resolve(folder).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(folder).startsWith("nmt-video-actions-")) throw new Error("Unsafe cleanup target");
  rmSync(folder, { recursive: true });
});

it("adds only a SUGGESTED non-primary and does not change Topic", async () => {
  const topic = await prisma.topic.findUnique({ where: { id: "qa-topic" } });
  const id = await add();
  expect(await prisma.videoLesson.findUnique({ where: { id } })).toMatchObject({ reviewStatus: "SUGGESTED", isPrimary: false });
  expect(await prisma.topic.findUnique({ where: { id: "qa-topic" } })).toEqual(topic);
});
it.each(["SUGGESTED", "REJECTED", "CONFIRMED"])("duplicate preserves every field of %s", async reviewStatus => {
  const id = await add();
  await prisma.videoLesson.update({ where: { id }, data: { reviewStatus, channel: "QA channel", role: "examples", durationSec: 321, notes: "legacy QA", lastPositionSec: 12 } });
  const before = await prisma.videoLesson.findUnique({ where: { id } });
  expect(await addVideo("qa-topic", url(0), "replacement title", "tasks")).toMatchObject({ ok: true, id });
  expect(await prisma.videoLesson.count()).toBe(1);
  expect(await prisma.videoLesson.findUnique({ where: { id } })).toEqual(before);
});
it("explicit confirmation makes first confirmed primary; adding another does not", async () => {
  const a = await add(); await setVideoReview(a, "CONFIRMED"); const b = await add(1);
  expect(await primary()).toMatchObject([{ id: a, reviewStatus: "CONFIRMED" }]);
  expect(await prisma.videoLesson.findUnique({ where: { id: b } })).toMatchObject({ isPrimary: false, reviewStatus: "SUGGESTED" });
});
it("selects only one confirmed primary and repairs legacy flags", async () => {
  const a = await add(), b = await add(1), c = await add(2);
  await prisma.videoLesson.updateMany({ data: { isPrimary: true } });
  await prisma.videoLesson.updateMany({ where: { id: { in: [a, b] } }, data: { reviewStatus: "CONFIRMED" } });
  expect(await makePrimary(b)).toMatchObject({ ok: true });
  expect(await primary()).toMatchObject([{ id: b }]);
  expect(await prisma.videoLesson.findUnique({ where: { id: c } })).toMatchObject({ isPrimary: false });
});
it.each(["SUGGESTED", "REJECTED"])("cannot promote %s and refusal leaves data unchanged", async reviewStatus => {
  const id = await add(); await prisma.videoLesson.update({ where: { id }, data: { reviewStatus } });
  const before = await snapshot(); expect(await makePrimary(id)).toMatchObject({ ok: false }); expect(await snapshot()).toEqual(before);
});
it("refuses replacement ID without changing old video, either user's progress or audit", async () => {
  const id = await add(); await setVideoReview(id, "CONFIRMED");
  for (const userId of ["qa-owner", "qa-student"]) await prisma.userVideoProgress.create({ data: { userId, videoId: id, lastPositionSec: 42, notes: "personal QA note" } });
  const before = await snapshot();
  expect(await updateVideo(id, url(1), "Different video")).toMatchObject({ ok: false });
  expect(await snapshot()).toEqual(before);
});
it("title-only edit preserves ID, confirmation, metadata and all progress", async () => {
  const id = await add(); await setVideoReview(id, "CONFIRMED");
  await prisma.userVideoProgress.create({ data: { userId: "qa-student", videoId: id, lastPositionSec: 42, notes: "QA note" } });
  const before = await prisma.videoLesson.findUniqueOrThrow({ where: { id } }); const progress = await prisma.userVideoProgress.findMany();
  expect(await updateVideo(id, url(0), "New title")).toMatchObject({ ok: true });
  const after = await prisma.videoLesson.findUniqueOrThrow({ where: { id } });
  expect({ ...after, title: before.title, updatedAt: before.updatedAt }).toEqual(before);
  expect(after.title).toBe("New title"); expect(await prisma.userVideoProgress.findMany()).toEqual(progress);
});
it.each(["reject", "delete"])("%s primary chooses only another confirmed video", async operation => {
  const a = await add(), b = await add(1); await add(2); await setVideoReview(a, "CONFIRMED"); await setVideoReview(b, "CONFIRMED");
  expect(await (operation === "reject" ? setVideoReview(a, "REJECTED") : deleteVideo(a))).toMatchObject({ ok: true });
  expect(await primary()).toMatchObject([{ id: b, reviewStatus: "CONFIRMED" }]);
  await setVideoReview(b, "REJECTED"); expect(await primary()).toEqual([]);
});
it("category change cannot promote an unreviewed video", async () => {
  const id = await add(); expect(await setVideoRole(id, "primary")).toMatchObject({ ok: true }); expect(await primary()).toEqual([]);
});
it("student markup excludes SUGGESTED, REJECTED and unknown statuses", () => {
  const videos = ["SUGGESTED", "REJECTED", "UNKNOWN", "CONFIRMED"].map((reviewStatus, index) => ({ id: "qa-" + index, youtubeId: ids[0], url: url(0), title: "SECRET_" + reviewStatus, reviewStatus, isPrimary: false, durationSec: null, lastPositionSec: 0, notes: "NOTE_" + reviewStatus }));
  const html = renderToStaticMarkup(createElement(VideoPanel, { topicId: "qa-topic", videos, canEdit: false }));
  expect(html).toContain("SECRET_CONFIRMED");
  for (const status of ["SUGGESTED", "REJECTED", "UNKNOWN"]) { expect(html).not.toContain("SECRET_" + status); expect(html).not.toContain("NOTE_" + status); }
  expect(renderToStaticMarkup(createElement(VideoPanel, { topicId: "qa-topic", videos, canEdit: true }))).toContain("SECRET_SUGGESTED");
});
it.each([null, "STUDENT"])("unauthorized role %s cannot edit or create audit records", async role => {
  const id = await add(); auth.user = role ? { id: "qa-student", role, accountStatus: "APPROVED" } : null;
  const before = await snapshot();
  for (const action of [() => addVideo("qa-topic", url(1), "QA"), () => updateVideo(id, url(0), "QA"), () => makePrimary(id), () => setVideoRole(id, "simple"), () => setVideoReview(id, "CONFIRMED"), () => deleteVideo(id)]) expect(await action()).toMatchObject({ ok: false });
  expect(await snapshot()).toEqual(before);
});
it("invalid URL, missing video/topic and invalid status do not write", async () => {
  const before = await snapshot();
  for (const action of [() => addVideo("qa-topic", "https://evil.example", "QA"), () => addVideo("missing", url(0), "QA"), () => makePrimary("missing"), () => updateVideo("missing", url(0), "QA"), () => setVideoReview("missing", "CONFIRMED"), () => setVideoReview("missing", "INVALID" as "CONFIRMED")]) expect(await action()).toMatchObject({ ok: false });
  expect(await snapshot()).toEqual(before);
});
it("personal notes and position remain per-user without shared metadata writes", async () => {
  const id = await add(); await setVideoReview(id, "CONFIRMED"); const video = await prisma.videoLesson.findUnique({ where: { id } });
  for (const [userId, position] of [["qa-owner", 10], ["qa-student", 42]] as const) { auth.user = { id: userId, role: userId === "qa-owner" ? "OWNER" : "STUDENT", accountStatus: "APPROVED" }; expect(await saveVideoNotes(id, userId + " QA note")).toMatchObject({ ok: true }); expect(await saveVideoPosition(id, position, 99999)).toMatchObject({ ok: true }); }
  expect(await prisma.userVideoProgress.findMany({ orderBy: { userId: "asc" } })).toMatchObject([{ userId: "qa-owner", lastPositionSec: 10 }, { userId: "qa-student", lastPositionSec: 42 }]);
  expect(await prisma.videoLesson.findUnique({ where: { id } })).toEqual(video);
});
it("concurrent add from independent SQLite clients creates only one candidate", async () => {
  const { withClient } = await fixtureModule();
  const results = await Promise.all([0, 1].map(index => withClient(index, () => addVideo("qa-topic", url(0), "QA same"))));
  expect(results.every(result => result.ok)).toBe(true); expect(await prisma.videoLesson.count()).toBe(1); expect(await primary()).toEqual([]);
});
it("concurrent confirmations and primary changes on independent clients keep one primary", async () => {
  const a = await add(), b = await add(1); const { withClient } = await fixtureModule();
  expect(await Promise.all([withClient(0, () => setVideoReview(a, "CONFIRMED")), withClient(1, () => setVideoReview(b, "CONFIRMED"))])).toMatchObject([{ ok: true }, { ok: true }]);
  expect(await primary()).toHaveLength(1);
  expect(await Promise.all([withClient(0, () => makePrimary(a)), withClient(1, () => makePrimary(b))])).toMatchObject([{ ok: true }, { ok: true }]);
  expect(await primary()).toHaveLength(1);
});

it.each([false, true])("seven candidates share one transaction, forced failure=%s", async forceFailure => {
  for (let index = 1; index < 7; index++) await prisma.topic.create({ data: { id: "qa-batch-" + index, subjectId: "qa-subject", title: "QA batch", sortOrder: index, coverage: "DRAFT", lessonJson: "unchanged" } });
  const before = await snapshot();
  const operation = prisma.$transaction(async tx => {
    for (let index = 0; index < 7; index++) {
      const result = await addVideoCandidate(tx, index ? "qa-batch-" + index : "qa-topic", ids[0], "QA batch video");
      await recordAudit(auth.user!, { action: "VIDEO_ADDED", entityType: "video", entityId: result.id }, tx);
      if (forceFailure && index === 3) throw new Error("QA forced rollback");
    }
  });
  if (forceFailure) { await expect(operation).rejects.toThrow("QA forced rollback"); expect(await snapshot()).toEqual(before); }
  else { await operation; expect(await prisma.videoLesson.count()).toBe(7); expect(await prisma.videoLesson.count({ where: { reviewStatus: "SUGGESTED", isPrimary: false } })).toBe(7); expect(await prisma.auditLog.count()).toBe(7); expect(await prisma.topic.findMany()).toEqual(before.topic); }
});
