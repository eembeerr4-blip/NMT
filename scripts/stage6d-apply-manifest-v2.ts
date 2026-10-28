import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prepareQuestion } from "../src/lib/question-input";

export type ManifestV2 = {
  version: number;
  corrections: {
    id: string;
    match?: { prompt?: string; promptSha256?: string; promptContains?: string };
    question: unknown;
  }[];
  questions: Array<{ id: string; origin?: string; [key: string]: unknown }>;
};

export function loadManifestV2(root = process.cwd()) {
  return JSON.parse(
    readFileSync(path.join(root, "content/stage6b/stage6b-question-bank-manifest.v2.json"), "utf8"),
  ) as ManifestV2;
}

export function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function persistLikeSaveQuestion(
  tx: Prisma.TransactionClient,
  raw: unknown,
  source = "stage6d-manifest-v2",
) {
  const q = prepareQuestion(raw, { preserveIds: Boolean((raw as { id?: string }).id) });
  const topic = await tx.topic.findUnique({ where: { id: q.topicId } });
  if (!topic || topic.subjectId !== q.subjectId) throw new Error(`Topic/subject mismatch for ${q.topicId}`);
  const { options, id, ...data } = q;
  const saved = await tx.question.upsert({
    where: { id: id! },
    update: { ...data, source, verificationStatus: "DRAFT" },
    create: { ...data, id: id!, source, verificationStatus: "DRAFT" },
  });
  await tx.questionOption.deleteMany({ where: { questionId: saved.id } });
  if (options.length) {
    await tx.questionOption.createMany({
      data: options.map((option, index) => ({
        ...option,
        questionId: saved.id,
        sortOrder: index,
      })),
    });
  }
  return saved;
}

export function assertCorrectionMatch(
  existing: { prompt: string },
  match: NonNullable<ManifestV2["corrections"][number]["match"]>,
  id: string,
) {
  if (match.prompt && existing.prompt !== match.prompt) {
    throw new Error(`Match failed ${id}: prompt differs from expected v1 text`);
  }
  if (match.promptSha256 && sha256(existing.prompt) !== match.promptSha256) {
    throw new Error(`Match failed ${id}: promptSha256`);
  }
  if (match.promptContains && !existing.prompt.includes(match.promptContains)) {
    throw new Error(`Match failed ${id}: promptContains`);
  }
}

export async function applyManifestV2(
  tx: Prisma.TransactionClient,
  manifest: ManifestV2,
  options: { strictCorrectionMatch: boolean },
) {
  const results = { updatedFromCorrections: 0, upserted: 0, skippedVerified: 0 };
  for (const correction of manifest.corrections) {
    const existing = await tx.question.findUnique({ where: { id: correction.id } });
    if (existing && options.strictCorrectionMatch && correction.match) {
      assertCorrectionMatch(existing, correction.match, correction.id);
    }
    await persistLikeSaveQuestion(tx, correction.question);
    results.updatedFromCorrections += 1;
  }
  for (const row of manifest.questions) {
    const existing = await tx.question.findUnique({ where: { id: row.id }, select: { verificationStatus: true } });
    if (existing?.verificationStatus === "VERIFIED") {
      results.skippedVerified += 1;
      continue;
    }
    await persistLikeSaveQuestion(tx, row);
    results.upserted += 1;
  }
  return results;
}
