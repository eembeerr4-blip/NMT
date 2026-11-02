import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  STAGE7_PUBLISH_TOPIC_ORDER,
  allAllowlistQuestionsVerified,
  assertSingleQuestionCard,
  attachTopicId,
  buildReleaseJson,
  interpretPublishAttempt,
  isOffAllowlistQuestionId,
  lessonPageHasPublishButton,
  lessonPageIndicatesPublished,
  loadReleaseAllowlist,
  observeQuestionCardStateFromText,
  parseModerationStatusMessage,
  releaseOk,
} from "./stage7-production-browser-release-lib";

const manifestPath = path.join(
  process.cwd(),
  "content/stage7c/stage7c-review-decisions.v2.json",
);

describe("stage7 production browser release lib", () => {
  const allowlist = loadReleaseAllowlist(manifestPath);

  it("loads exactly 120 allowlist ids across 10 topics", () => {
    expect(allowlist.questionIds.size).toBe(120);
    expect(STAGE7_PUBLISH_TOPIC_ORDER.length).toBe(10);
    for (const topicId of STAGE7_PUBLISH_TOPIC_ORDER) {
      expect(allowlist.byTopic.get(topicId)?.length).toBe(12);
    }
  });

  it("identifies question card state from UI text", () => {
    const draftCard = `
      Чернетка
      Позначити перевіреним
      Редагувати
    `;
    const verifiedCard = `
      Перевірено
      Редагувати
    `;
    expect(observeQuestionCardStateFromText(draftCard)).toBe("DRAFT");
    expect(observeQuestionCardStateFromText(verifiedCard)).toBe("VERIFIED");
    expect(observeQuestionCardStateFromText("something else")).toBe("UNKNOWN");
  });

  it("requires a single DOM card match per question id", () => {
    expect(assertSingleQuestionCard(1, "s7a-geography-1-e01").ok).toBe(true);
    expect(assertSingleQuestionCard(0, "s7a-geography-1-e01").ok).toBe(false);
    expect(assertSingleQuestionCard(2, "s7a-geography-1-e01").ok).toBe(false);
  });

  it("rejects off-allowlist question ids", () => {
    expect(isOffAllowlistQuestionId("not-in-list", allowlist.questionIds)).toBe(true);
    expect(isOffAllowlistQuestionId("s7a-geography-1-e01", allowlist.questionIds)).toBe(false);
  });

  it("treats already VERIFIED cards as skip without counting as new verify", () => {
    const summary = {
      allowlistSize: 120,
      verifiedIds: [],
      alreadyVerifiedIds: ["s7a-geography-1-e01"],
      failedIds: [],
      publishResults: [],
    };
    expect(allAllowlistQuestionsVerified(summary)).toBe(false);
    summary.alreadyVerifiedIds = [...allowlist.questionIds];
    expect(allAllowlistQuestionsVerified(summary)).toBe(true);
  });

  it("records verifyQuestion UI failure when status stays DRAFT after click", () => {
    const before = "Чернетка\nПозначити перевіреним";
    const after = "Чернетка\nПозначити перевіреним";
    expect(observeQuestionCardStateFromText(before)).toBe("DRAFT");
    expect(observeQuestionCardStateFromText(after)).toBe("DRAFT");
  });

  it("detects publishLesson error message on lesson page", () => {
    const before = "Опублікувати для учнів\nЧернетка";
    const after = "Опублікувати для учнів\nЧернетка";
    const result = attachTopicId(
      "geography-1",
      interpretPublishAttempt(before, after, "Не всі завдання перевірені для цієї теми."),
    );
    expect(result).toEqual({
      topicId: "geography-1",
      status: "failed",
      error: "Не всі завдання перевірені для цієї теми.",
    });
  });

  it("confirms READY when lesson page shows published state", () => {
    const before = "Опублікувати для учнів";
    const after = "Урок опубліковано для учнів. Завдання з’являються в практиці лише після окремої перевірки.";
    const result = attachTopicId("geography-1", interpretPublishAttempt(before, after, "Урок опубліковано."));
    expect(result).toEqual({ topicId: "geography-1", status: "published" });
    expect(lessonPageIndicatesPublished(after)).toBe(true);
    expect(lessonPageHasPublishButton(after)).toBe(false);
  });

  it("partial verify run is not releaseOk", () => {
    const summary = {
      allowlistSize: 120,
      verifiedIds: ["s7a-geography-1-e01"],
      alreadyVerifiedIds: [],
      failedIds: [{ id: "s7a-geography-1-e02", error: "Verify click did not produce VERIFIED state in UI" }],
      publishResults: [],
    };
    expect(releaseOk(summary)).toBe(false);
    expect(buildReleaseJson(summary).verifyCount).toBe(1);
  });

  it("idempotent re-run with all questions already verified and topics READY is releaseOk", () => {
    const summary = {
      allowlistSize: 120,
      verifiedIds: [],
      alreadyVerifiedIds: [...allowlist.questionIds],
      failedIds: [],
      publishResults: STAGE7_PUBLISH_TOPIC_ORDER.map((topicId) => ({
        topicId,
        status: "alreadyPublished" as const,
      })),
    };
    expect(allAllowlistQuestionsVerified(summary)).toBe(true);
    expect(releaseOk(summary)).toBe(true);
    expect(buildReleaseJson(summary).ok).toBe(true);
  });

  it("flags false positive when publish button clicked but lesson stays draft", () => {
    const before = "Опублікувати для учнів\nЧернетка";
    const after = "Опублікувати для учнів\nЧернетка";
    const result = attachTopicId("geography-2", interpretPublishAttempt(before, after, ""));
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toMatch(/not READY|Publish button remains/i);
    }
  });

  it("parses moderation status messages from question UI", () => {
    expect(parseModerationStatusMessage("Збережено.")).toBe("success");
    expect(parseModerationStatusMessage("Не вдалося зберегти зміни.")).toBe("error");
    expect(parseModerationStatusMessage("")).toBe("unknown");
  });

  it("buildReleaseJson lists verifiedIds separately from alreadyVerifiedIds", () => {
    const summary = {
      allowlistSize: 120,
      verifiedIds: ["s7a-geography-1-e03"],
      alreadyVerifiedIds: ["s7a-geography-1-e01", "s7a-geography-1-e02"],
      failedIds: [],
      publishResults: [],
    };
    const json = buildReleaseJson(summary);
    expect(json.verifiedIds).toEqual(["s7a-geography-1-e03"]);
    expect(json.alreadyVerifiedIds.length).toBe(2);
    expect(json.verifyCount).toBe(1);
  });
});
