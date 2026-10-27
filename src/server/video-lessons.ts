import type { Prisma } from "@prisma/client";
import { UserError } from "@/lib/errors";
import { youtubeWatchUrl } from "@/lib/youtube";

// Take SQLite's writer lock before reading: concurrent connections cannot both
// select an old primary or pass the same duplicate check in deferred transactions.
export async function lockVideo(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`UPDATE "VideoLesson" SET "id" = "id" WHERE "id" = ${id}`;
  const video = await tx.videoLesson.findUnique({ where: { id } });
  if (!video) throw new UserError("Відео не знайдено.");
  return video;
}

export async function reconcileVideoPrimary(tx: Prisma.TransactionClient, topicId: string, preferredId?: string) {
  const confirmed = await tx.videoLesson.findMany({
    where: { topicId, reviewStatus: "CONFIRMED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const next = confirmed.find(video => video.id === preferredId)
    ?? confirmed.find(video => video.isPrimary) ?? confirmed[0];
  await tx.videoLesson.updateMany({ where: { topicId, isPrimary: true }, data: { isPrimary: false } });
  if (next) await tx.videoLesson.update({ where: { id: next.id }, data: { isPrimary: true } });
}

// Shared by the single-video action and owner-authorized atomic maintenance.
export async function addVideoCandidate(tx: Prisma.TransactionClient, topicId: string, youtubeId: string, title: string, role = "primary"): Promise<{ ok: true; id: string; message: string }> {
  await tx.$executeRaw`UPDATE "Topic" SET "id" = "id" WHERE "id" = ${topicId}`;
  if (!await tx.topic.findUnique({ where: { id: topicId }, select: { id: true } })) throw new UserError("Тему не знайдено.");
  const existing = await tx.videoLesson.findFirst({ where: { topicId, youtubeId } });
  if (existing) return { ok: true, id: existing.id, message: "Це відео вже є в темі. Його статус і дані не змінено." };
  const video = await tx.videoLesson.create({ data: {
    topicId, youtubeId, url: youtubeWatchUrl(youtubeId), title: title.trim(),
    role: ["primary", "simple", "examples", "tasks"].includes(role) ? role : "primary",
    reviewStatus: "SUGGESTED", isPrimary: false,
  } });
  return { ok: true, id: video.id, message: "Відеокандидат додано. Потрібна окрема перевірка редактором." };
}
