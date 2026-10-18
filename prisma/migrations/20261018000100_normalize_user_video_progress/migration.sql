-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserVideoProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserVideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoLesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserVideoProgress" ("id", "lastPositionSec", "notes", "updatedAt", "userId", "videoId") SELECT "id", "lastPositionSec", "notes", "updatedAt", "userId", "videoId" FROM "UserVideoProgress";
DROP TABLE "UserVideoProgress";
ALTER TABLE "new_UserVideoProgress" RENAME TO "UserVideoProgress";
CREATE UNIQUE INDEX "UserVideoProgress_userId_videoId_key" ON "UserVideoProgress"("userId", "videoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

