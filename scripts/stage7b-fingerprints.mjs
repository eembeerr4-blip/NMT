import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

function sha(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function rows(db, sql) {
  return db.prepare(sql).all();
}

/** Deterministic fingerprints for Stage 7B data protection. */
export function captureFingerprints(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });

  const tableCount = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;

  const userRows = rows(
    db,
    `SELECT id, role, accountStatus, nickname, onboarded FROM User ORDER BY id`,
  );
  const settingsRows = rows(db, `SELECT id, userId, mathPriority FROM UserSettings ORDER BY id`);
  const studyTaskRows = rows(
    db,
    `SELECT id, userId, dateKey, templateKey, topicId FROM StudyTask ORDER BY id`,
  );
  const progressRows = rows(
    db,
    `SELECT id, userId, topicId, status FROM UserTopicProgress ORDER BY id`,
  );
  const attemptRows = rows(
    db,
    `SELECT id, userId, testId, status, correctCount, totalCount FROM TestAttempt ORDER BY id`,
  );
  const answerRows = rows(
    db,
    `SELECT id, attemptId, questionId, isCorrect FROM Answer ORDER BY id`,
  );
  const examRows = rows(
    db,
    `SELECT id, userId, subjectId, rawScore, ratingScore FROM ExamResult ORDER BY id`,
  );
  const mistakeRows = rows(db, `SELECT id, userId, questionId FROM Mistake ORDER BY id`);
  const retryRows = rows(db, `SELECT id, mistakeId, isCorrect FROM MistakeRetry ORDER BY id`);
  const reviewRows = rows(
    db,
    `SELECT id, userId, topicId, dueKey, status FROM ReviewSchedule ORDER BY id`,
  );
  const flashRows = rows(db, `SELECT id, userId, front FROM Flashcard ORDER BY id`);
  const videoRows = rows(
    db,
    `SELECT id, topicId, youtubeId, reviewStatus, isPrimary FROM VideoLesson ORDER BY id`,
  );
  const auditRows = rows(
    db,
    `SELECT id, action, entityType, entityId FROM AuditLog ORDER BY id`,
  );

  const readyTopics = rows(
    db,
    `SELECT id, coverage, length(lessonJson) AS lessonLen FROM Topic WHERE coverage='READY' ORDER BY id`,
  );
  const readyQuestions = rows(
    db,
    `SELECT id, topicId, verificationStatus FROM Question WHERE topicId IN (
      'ukr-lex-01-meaning','ukr-lex-02-syn-ant-hom','ukr-lex-03-phraseology',
      'bio-cell-01-eukaryotic-cell','zcode-biology-molecular-dna-rna',
      'zcode-biology-molecular-protein-synth','zcode-biology-molecular-division'
    ) ORDER BY id`,
  );

  const topicCoverage = rows(db, `SELECT id, coverage FROM Topic ORDER BY id`);

  const integrity = db.prepare("PRAGMA integrity_check").get();
  const fk = rows(db, "PRAGMA foreign_key_check");

  const answerCheckDigest = sha(
    rows(db, `SELECT id, lessonJson FROM Topic WHERE coverage='READY' ORDER BY id`)
      .map((t) => {
        let n = 0;
        try {
          const lesson = JSON.parse(t.lessonJson || "{}");
          n = (lesson.examples ?? []).filter((e) => e && e.answerCheck).length;
        } catch {
          /* ignore */
        }
        return `${t.id}:${n}:${t.lessonJson?.length ?? 0}`;
      })
      .join("|"),
  );

  const counts = {
    User: tableCount("User"),
    UserSettings: tableCount("UserSettings"),
    StudyTask: tableCount("StudyTask"),
    UserTopicProgress: tableCount("UserTopicProgress"),
    TestAttempt: tableCount("TestAttempt"),
    Answer: tableCount("Answer"),
    ExamResult: tableCount("ExamResult"),
    Mistake: tableCount("Mistake"),
    MistakeRetry: tableCount("MistakeRetry"),
    ReviewSchedule: tableCount("ReviewSchedule"),
    Flashcard: tableCount("Flashcard"),
    VideoLesson: tableCount("VideoLesson"),
    AuditLog: tableCount("AuditLog"),
    Topic: tableCount("Topic"),
    Question: tableCount("Question"),
    QuestionOption: tableCount("QuestionOption"),
  };

  const verifiedQuestionCount = db
    .prepare(`SELECT COUNT(*) AS c FROM Question WHERE verificationStatus='VERIFIED'`)
    .get().c;

  db.close();

  return {
    capturedAt: new Date().toISOString(),
    dbPath,
    counts,
    digests: {
      User: sha(JSON.stringify(userRows)),
      UserSettings: sha(JSON.stringify(settingsRows)),
      StudyTask: sha(JSON.stringify(studyTaskRows)),
      UserTopicProgress: sha(JSON.stringify(progressRows)),
      TestAttempt: sha(JSON.stringify(attemptRows)),
      Answer: sha(JSON.stringify(answerRows)),
      ExamResult: sha(JSON.stringify(examRows)),
      Mistake: sha(JSON.stringify(mistakeRows)),
      MistakeRetry: sha(JSON.stringify(retryRows)),
      ReviewSchedule: sha(JSON.stringify(reviewRows)),
      Flashcard: sha(JSON.stringify(flashRows)),
      VideoLesson: sha(JSON.stringify(videoRows)),
      AuditLog: sha(JSON.stringify(auditRows)),
      TopicCoverage: sha(JSON.stringify(topicCoverage)),
      ReadyTopicMeta: sha(JSON.stringify(readyTopics)),
      ReadyQuestions: sha(JSON.stringify(readyQuestions)),
      Stage6AnswerCheckSlots: answerCheckDigest,
    },
    integrity: integrity?.integrity_check,
    foreignKeyViolations: fk.length,
    verifiedQuestionCount,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error("Usage: node stage7b-fingerprints.mjs <absolute.db>");
    process.exit(1);
  }
  console.log(JSON.stringify(captureFingerprints(dbPath), null, 2));
}
