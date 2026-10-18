-- DropIndex
DROP INDEX "StudyTask_dateKey_templateKey_key";

-- AlterTable
ALTER TABLE "AIConversation" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "ExamResult" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Mistake" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "ReviewSchedule" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "StudyTask" ADD COLUMN "movedFromId" TEXT;
ALTER TABLE "StudyTask" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "XpEvent" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "diagnosticSkipped" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "examYear" INTEGER NOT NULL DEFAULT 2027,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSubject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "UserSubject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTopicProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "lastCorrect" INTEGER,
    "lastTotal" INTEGER,
    CONSTRAINT "UserTopicProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserVideoProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserVideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoLesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "formulas" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "coverage" TEXT NOT NULL DEFAULT 'NEEDS_CONTENT',
    "lessonJson" TEXT NOT NULL DEFAULT '',
    "estimatedMin" INTEGER NOT NULL DEFAULT 25,
    "lastCorrect" INTEGER,
    "lastTotal" INTEGER,
    CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Topic" ("formulas", "id", "lastCorrect", "lastTotal", "parentId", "sortOrder", "status", "subjectId", "summary", "title") SELECT "formulas", "id", "lastCorrect", "lastTotal", "parentId", "sortOrder", "status", "subjectId", "summary", "title" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
CREATE INDEX "Topic_subjectId_sortOrder_idx" ON "Topic"("subjectId", "sortOrder");
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "userId" TEXT,
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
    "dailyMinutes" INTEGER NOT NULL DEFAULT 150,
    "intensity" TEXT NOT NULL DEFAULT 'standard',
    "preferredTime" TEXT NOT NULL DEFAULT '18:00',
    "studyDaysJson" TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("aiModel", "aiProvider", "biologyPriority", "createdAt", "examDate", "formatJson", "historyPriority", "id", "masteryHighMin", "masteryMidMin", "mathPriority", "planStart", "scheduleJson", "targetScore", "theme", "timerEnabled", "ukrainianPriority", "updatedAt") SELECT "aiModel", "aiProvider", "biologyPriority", "createdAt", "examDate", "formatJson", "historyPriority", "id", "masteryHighMin", "masteryMidMin", "mathPriority", "planStart", "scheduleJson", "targetScore", "theme", "timerEnabled", "ukrainianPriority", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE TABLE "new_VideoLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'primary',
    "channel" TEXT NOT NULL DEFAULT '',
    "reviewStatus" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "language" TEXT NOT NULL DEFAULT 'uk',
    "durationSec" INTEGER,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoLesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoLesson" ("createdAt", "durationSec", "id", "isPrimary", "lastPositionSec", "notes", "title", "topicId", "updatedAt", "url", "youtubeId") SELECT "createdAt", "durationSec", "id", "isPrimary", "lastPositionSec", "notes", "title", "topicId", "updatedAt", "url", "youtubeId" FROM "VideoLesson";
DROP TABLE "VideoLesson";
ALTER TABLE "new_VideoLesson" RENAME TO "VideoLesson";
CREATE INDEX "VideoLesson_topicId_idx" ON "VideoLesson"("topicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubject_userId_subjectId_key" ON "UserSubject"("userId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopicProgress_userId_topicId_key" ON "UserTopicProgress"("userId", "topicId");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVideoProgress_userId_videoId_key" ON "UserVideoProgress"("userId", "videoId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "ExamResult_userId_date_idx" ON "ExamResult"("userId", "date");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "StudySession"("userId");

-- CreateIndex
CREATE INDEX "StudyTask_userId_dateKey_idx" ON "StudyTask"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudyTask_userId_dateKey_templateKey_key" ON "StudyTask"("userId", "dateKey", "templateKey");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_idx" ON "TestAttempt"("userId");

