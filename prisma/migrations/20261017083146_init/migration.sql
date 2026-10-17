-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "examDate" DATETIME,
    "targetScore" INTEGER NOT NULL DEFAULT 150,
    "masteryHighMin" INTEGER NOT NULL DEFAULT 10,
    "masteryMidMin" INTEGER NOT NULL DEFAULT 7,
    "aiProvider" TEXT NOT NULL DEFAULT 'none',
    "aiModel" TEXT NOT NULL DEFAULT '',
    "mathPriority" INTEGER NOT NULL DEFAULT 35,
    "ukrainianPriority" INTEGER NOT NULL DEFAULT 25,
    "historyPriority" INTEGER NOT NULL DEFAULT 20,
    "biologyPriority" INTEGER NOT NULL DEFAULT 20,
    "timerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleJson" TEXT NOT NULL,
    "formatJson" TEXT NOT NULL,
    "planStart" TEXT NOT NULL DEFAULT '2026-10-19',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "formulas" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "lastCorrect" INTEGER,
    "lastTotal" INTEGER,
    CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,
    CONSTRAINT "TopicDependency_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "durationSec" INTEGER,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoLesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "subtopic" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "verificationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
    "issueReport" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "matchKey" TEXT,
    CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "timeLimitSec" INTEGER,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Test_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Test_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "durationSec" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "draftJson" TEXT NOT NULL DEFAULT '{}',
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER,
    "totalCount" INTEGER,
    "pendingCount" INTEGER,
    "percent" REAL,
    CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "needsManualReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "testType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "rawScore" INTEGER,
    "maxRawScore" INTEGER,
    "ratingScore" INTEGER,
    "belowThreshold" BOOLEAN NOT NULL DEFAULT false,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "countsTowardAverage" BOOLEAN NOT NULL DEFAULT false,
    "durationSec" INTEGER,
    "errorCount" INTEGER,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamResult_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT,
    "topicId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'study',
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "StudySession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudySession_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateKey" TEXT NOT NULL,
    "subjectId" TEXT,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "templateKey" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudyTask_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "dueKey" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSchedule_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mistake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "questionId" TEXT,
    "prompt" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'UNKNOWN_TOPIC',
    "repeatCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mistake_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mistake_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mistake_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT,
    "topicId" TEXT,
    "kind" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "ease" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "dueKey" TEXT NOT NULL,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Flashcard_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Flashcard_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "messagesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" DATETIME
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Topic_subjectId_sortOrder_idx" ON "Topic"("subjectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TopicDependency_topicId_prerequisiteId_key" ON "TopicDependency"("topicId", "prerequisiteId");

-- CreateIndex
CREATE INDEX "VideoLesson_topicId_idx" ON "VideoLesson"("topicId");

-- CreateIndex
CREATE INDEX "Note_topicId_idx" ON "Note"("topicId");

-- CreateIndex
CREATE INDEX "Note_subjectId_idx" ON "Note"("subjectId");

-- CreateIndex
CREATE INDEX "Question_subjectId_topicId_verificationStatus_idx" ON "Question"("subjectId", "topicId", "verificationStatus");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "Test_topicId_idx" ON "Test"("topicId");

-- CreateIndex
CREATE INDEX "Test_subjectId_idx" ON "Test"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TestQuestion_testId_questionId_key" ON "TestQuestion"("testId", "questionId");

-- CreateIndex
CREATE INDEX "TestAttempt_status_idx" ON "TestAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "ExamResult_subjectId_date_idx" ON "ExamResult"("subjectId", "date");

-- CreateIndex
CREATE INDEX "StudySession_startedAt_idx" ON "StudySession"("startedAt");

-- CreateIndex
CREATE INDEX "StudyTask_dateKey_status_idx" ON "StudyTask"("dateKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudyTask_dateKey_templateKey_key" ON "StudyTask"("dateKey", "templateKey");

-- CreateIndex
CREATE INDEX "ReviewSchedule_dueKey_status_idx" ON "ReviewSchedule"("dueKey", "status");

-- CreateIndex
CREATE INDEX "Mistake_subjectId_status_idx" ON "Mistake"("subjectId", "status");

-- CreateIndex
CREATE INDEX "Mistake_topicId_idx" ON "Mistake"("topicId");

-- CreateIndex
CREATE INDEX "Flashcard_dueKey_idx" ON "Flashcard"("dueKey");
