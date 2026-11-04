-- Block 01 cleanup: drop removed feature tables and settings columns.
-- Apply only after owner-approved backup of prisma/dev.db.

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "AIMessage";
DROP TABLE IF EXISTS "AIConversation";
DROP TABLE IF EXISTS "XpEvent";
DROP TABLE IF EXISTS "Achievement";
DROP TABLE IF EXISTS "Note";

CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "examDate" DATETIME,
    "targetScore" INTEGER NOT NULL DEFAULT 150,
    "masteryHighMin" INTEGER NOT NULL DEFAULT 10,
    "masteryMidMin" INTEGER NOT NULL DEFAULT 7,
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
INSERT INTO "new_UserSettings" ("id", "userId", "theme", "examDate", "targetScore", "masteryHighMin", "masteryMidMin", "mathPriority", "ukrainianPriority", "historyPriority", "biologyPriority", "timerEnabled", "scheduleJson", "formatJson", "planStart", "dailyMinutes", "intensity", "preferredTime", "studyDaysJson", "createdAt", "updatedAt")
SELECT "id", "userId", "theme", "examDate", "targetScore", "masteryHighMin", "masteryMidMin", "mathPriority", "ukrainianPriority", "historyPriority", "biologyPriority", "timerEnabled", "scheduleJson", "formatJson", "planStart", "dailyMinutes", "intensity", "preferredTime", "studyDaysJson", "createdAt", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

PRAGMA foreign_keys=ON;
