import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "content", "stage6d");
const manifestV2 = JSON.parse(readFileSync(path.join(root, "content/stage6b/stage6b-question-bank-manifest.v2.json"), "utf8"));
const videoManifest = JSON.parse(readFileSync(path.join(root, "content/stage6c/stage6c-video-candidates.v1.json"), "utf8"));
const rehearsal = JSON.parse(readFileSync(path.join(outDir, "stage6d-rehearsal-report.json"), "utf8"));

const CORRECTIONS = manifestV2.corrections.map((row) => ({
  id: row.id,
  reason: row.reason,
}));

const releasePlan = {
  format: "nmt-stage6d-release-plan",
  version: 1,
  createdAt: new Date().toISOString(),
  appliesToWorkingDatabase: false,
  sources: {
    questionsManifest: "content/stage6b/stage6b-question-bank-manifest.v2.json",
    questionsManifestVersion: 2,
    questionsManifestCommit: "0e00742a695a6e6dd0f5fbc51d3985dc4d4a5808",
    videoManifest: "content/stage6c/stage6c-video-candidates.v1.json",
    videoManifestVersion: 1,
    videoManifestCommit: "4c155b4d5446d158fb3a1d9046f9ef262f2d93ee",
  },
  orderedSteps: [
    "Отримати рішення власника у stage6d-release-review.html (питання через stage6b2-owner-decisions.json + contentHash; відео — APPROVE_CANDIDATE / REPLACE / NEEDS_REVIEW).",
    "Перевірити свіжий backup робочої SQLite (окремий дозволений сценарій, не автоматично).",
    "Застосувати manifest v2 до робочої бази скриптом stage6d-apply-manifest-v2.ts з strictCorrectionMatch.",
    "Додати обрані VideoLesson через addVideoCandidate (лише SUGGESTED, isPrimary=false).",
    "Редакторськи перевести схвалені питання у VERIFIED (не автоматично).",
    "Після прослуховування/перегляду підтвердити відео (CONFIRMED) і призначити primary вручну.",
    "Перевірити lessonReadiness для кожної з 7 тем (practice уже 12/4-5-3; ready потребує theory/examples/CONFIRMED video).",
    "Окремо погодити зміну coverage з DRAFT на NEEDS_CONTENT або CONFIRMED — не входить у цей пакет.",
    "Публікувати лише уроки, де власник явно дозволив coverage + VERIFIED questions + CONFIRMED video.",
    "Перевірити учнівський сценарій (learn page, practice, без витоку SUGGESTED/DRAFT).",
  ],
  blockers: [
    "84 питання лишаються DRAFT до ручного VERIFIED.",
    "Рекомендовані відео не CONFIRMED; частина METADATA_ONLY / NOT_VERIFIED.",
    "coverage усіх 7 тем = DRAFT.",
    "Робочий імпорт не виконувався в Stage 6D.",
  ],
  rehearsalSummary: {
    qaDatabaseMethod: rehearsal.qaDatabase.backupMethod,
    additionCount: rehearsal.manifest.additionCount,
    idempotencyOk: rehearsal.apply.idempotencyOk,
    userTablesUnchanged: rehearsal.apply.userTablesUnchanged,
  },
};

writeFileSync(path.join(outDir, "stage6d-release-plan.v1.json"), `${JSON.stringify(releasePlan, null, 2)}\n`, "utf8");

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function videoRows(lesson) {
  const rec = lesson.recommendation;
  const primary = rec.primary ?? (rec.action === "KEEP_WITH_OWNER_PREVIEW" ? lesson.currentPrimary : null);
  const rows = [];
  if (primary) {
    rows.push({ kind: "primary", ...primary, current: lesson.currentPrimary.youtubeId === primary.youtubeId });
  } else if (lesson.currentPrimary) {
    rows.push({ kind: "primary", ...lesson.currentPrimary, current: true });
  }
  if (rec.supplement) rows.push({ kind: "supplement", ...rec.supplement, current: false });
  return rows;
}

const changedQuestions = manifestV2.questions.filter((q) => q.changedInV2).map((q) => q.id);

const packet = {
  packageId: "stage6d-release-review",
  questionManifestVersion: 2,
  videoManifestVersion: 1,
  appliedToDatabase: false,
  verificationStatusChanged: false,
  videoDecisionsApplied: false,
  lessons: videoManifest.lessons.map((lesson) => ({
    topicId: lesson.topicId,
    title: lesson.title,
    coverage: "DRAFT",
    questionCount: 12,
    changedQuestionIds: changedQuestions.filter((id) => id.startsWith(lesson.topicId.split("-").slice(0, 3).join("-")) || id.includes(lesson.topicId.replace(/-/g, "").slice(0, 8))),
    videos: videoRows(lesson).map((row) => ({
      youtubeId: row.youtubeId,
      title: row.title,
      channel: row.channel,
      role: row.kind,
      verificationLevel: row.verificationLevel,
      url: row.url,
    })),
  })),
};

// fix changed ids per topic properly
for (const lesson of packet.lessons) {
  lesson.changedQuestionIds = manifestV2.questions
    .filter((q) => q.topicId === lesson.topicId && q.changedInV2)
    .map((q) => q.id);
}

const cards = videoManifest.lessons
  .map((lesson) => {
    const changedIds = manifestV2.questions.filter((q) => q.topicId === lesson.topicId && q.changedInV2).map((q) => q.id);
    const rows = videoRows(lesson);
    const videoHtml = rows
      .map((row) => {
        const key = `${lesson.topicId}:${row.youtubeId}`;
        return `<div class="video-row" data-video-key="${esc(key)}" data-youtube-id="${esc(row.youtubeId)}">
          <p><strong>${row.kind === "primary" ? "Рекомендоване основне" : "Додаткове"}</strong>
          <span class="chip">${esc(row.verificationLevel)}</span>
          ${row.current ? '<span class="chip">збігається з дослідженням Stage 6C current</span>' : ""}</p>
          <p><a href="${esc(row.url)}" target="_blank" rel="noreferrer">${esc(row.title)}</a> · ${esc(row.channel)}</p>
          <p>${esc(row.verificationNotes ?? "")}</p>
          <div class="decision">
            <label><input type="radio" name="video-${esc(key)}" value="APPROVE_CANDIDATE" /> APPROVE_CANDIDATE</label>
            <label><input type="radio" name="video-${esc(key)}" value="REPLACE" /> REPLACE</label>
            <label><input type="radio" name="video-${esc(key)}" value="NEEDS_REVIEW" checked /> NEEDS_REVIEW</label>
          </div>
          <textarea data-comment-for="${esc(key)}" rows="2" placeholder="Коментар до відео"></textarea>
        </div>`;
      })
      .join("\n");

    return `<article id="${esc(lesson.topicId)}">
      <h2>${esc(lesson.title)}</h2>
      <p><code>${esc(lesson.topicId)}</code> · coverage: <strong>DRAFT</strong> · питань: <strong>12</strong> (manifest v2)</p>
      <p>Конспект: DRAFT / потребує окремої перевірки перед публікацією.</p>
      <p>Виправлені питання Stage 6B.2: ${esc(changedIds.join(", ") || "—")}</p>
      <p><a href="../stage6b/stage6b2-owner-review.html" target="_blank" rel="noreferrer">Повний пакет 84 питань (Stage 6B.2 HTML)</a></p>
      <h3>Відео</h3>
      <p>Поточне (Stage 6C): <a href="${esc(lesson.currentPrimary.url)}" target="_blank" rel="noreferrer">${esc(lesson.currentPrimary.title)}</a></p>
      ${videoHtml}
      <h3>Перевірено / залишилось власнику</h3>
      <ul>${lesson.ownerStillToCheck.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      <p><strong>Блокери:</strong> немає CONFIRMED video; coverage DRAFT; питання DRAFT; рішення власника не застосовані до БД.</p>
    </article>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stage 6D — Release Review</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; max-width: 960px; margin: 0 auto; padding: 1rem; line-height: 1.45; }
    .banner { background: #eef2ff; border: 1px solid #c7d2fe; padding: .75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
    article { border: 1px solid #ddd; border-radius: 10px; padding: 1rem; margin: 1rem 0; }
    .chip { display: inline-block; font-size: .75rem; background: #f3f4f6; padding: .1rem .45rem; border-radius: 999px; margin-left: .35rem; }
    .video-row { border-top: 1px dashed #ccc; padding-top: .75rem; margin-top: .75rem; }
    textarea { width: 100%; box-sizing: border-box; }
    .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    button { cursor: pointer; }
  </style>
</head>
<body>
  <div class="banner">
    <strong>Stage 6D Release Review</strong> — локальні рішення, не в prisma/dev.db.
    Питання: import <code>stage6b2-owner-decisions.json</code> з перевіркою <code>contentHash</code>.
    Відео: export нижче. Manifest v2 + Stage 6C v1.
  </div>
  <div class="toolbar">
    <button type="button" id="export-decisions">Експорт рішень JSON</button>
    <label>Імпорт stage6b2-owner-decisions.json <input type="file" id="import-b6b2" accept="application/json" /></label>
    <label>Імпорт stage6d-release-decisions.json <input type="file" id="import-6d" accept="application/json" /></label>
  </div>
  <p id="status"></p>
  ${cards}
  <script id="packet" type="application/json">${JSON.stringify(packet)}</script>
  <script id="question-manifest" type="application/json">${JSON.stringify({ version: 2, changedQuestions: manifestV2.questions.filter((q) => q.changedInV2).map((q) => ({ id: q.id, contentHash: q.contentHash })) })}</script>
  <script>
    const packet = JSON.parse(document.getElementById("packet").textContent);
    const questionManifest = JSON.parse(document.getElementById("question-manifest").textContent);
    const storageKey = "nmt-stage6d-release-decisions-v1";
    const status = document.getElementById("status");
    let importedQuestionDecisions = {};

    function collectVideoDecisions() {
      const decisions = {};
      for (const lesson of packet.lessons) {
        for (const video of lesson.videos) {
          const key = lesson.topicId + ":" + video.youtubeId;
          const picked = document.querySelector('input[name="video-' + key + '"]:checked');
          const comment = document.querySelector('[data-comment-for="' + key + '"]');
          decisions[key] = {
            topicId: lesson.topicId,
            youtubeId: video.youtubeId,
            role: video.role,
            verdict: picked ? picked.value : "NEEDS_REVIEW",
            comment: comment ? comment.value.trim() : "",
          };
        }
      }
      return decisions;
    }

    function exportDecisions() {
      const payload = {
        packageId: packet.packageId,
        questionManifestVersion: packet.questionManifestVersion,
        videoManifestVersion: packet.videoManifestVersion,
        exportedAt: new Date().toISOString(),
        appliedToDatabase: false,
        verificationStatusChanged: false,
        videoDecisionsApplied: false,
        importedQuestionDecisions,
        videoDecisions: collectVideoDecisions(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "stage6d-release-decisions.json";
      a.click();
      status.textContent = "Експортовано stage6d-release-decisions.json";
    }

    function considerImportB62(data) {
      if (data.packageId !== "stage6b2-owner-review" || data.manifestVersion !== 2) {
        status.textContent = "Відхилено: не stage6b2-owner-review v2";
        return;
      }
      const allowed = new Set(Object.keys(data.decisions || {}));
      importedQuestionDecisions = {};
      for (const row of questionManifest.changedQuestions) {
        const decision = data.decisions[row.id];
        if (!decision) continue;
        if (decision.contentHash !== row.contentHash) continue;
        importedQuestionDecisions[row.id] = decision;
      }
      status.textContent = "Імпортовано " + Object.keys(importedQuestionDecisions).length + " рішень по змінених питаннях (hash OK)";
    }

    function considerImport6d(data) {
      if (data.packageId !== packet.packageId) {
        status.textContent = "Відхилено: інший packageId";
        return;
      }
      for (const [key, decision] of Object.entries(data.videoDecisions || {})) {
        const input = document.querySelector('input[name="video-' + key + '"][value="' + decision.verdict + '"]');
        if (input) input.checked = true;
        const comment = document.querySelector('[data-comment-for="' + key + '"]');
        if (comment && decision.comment) comment.value = decision.comment;
      }
      status.textContent = "Відновлено відео-рішення з JSON";
    }

    document.getElementById("export-decisions").addEventListener("click", exportDecisions);
    document.getElementById("import-b6b2").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      considerImportB62(JSON.parse(await file.text()));
    });
    document.getElementById("import-6d").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      considerImport6d(JSON.parse(await file.text()));
    });
  </script>
</body>
</html>`;

writeFileSync(path.join(outDir, "stage6d-release-review.html"), html, "utf8");
console.log("Wrote stage6d-release-review.html and stage6d-release-plan.v1.json");
