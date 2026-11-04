CREATE TABLE "MistakeRetry" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "mistakeId" TEXT NOT NULL,
 "answerJson" TEXT NOT NULL,
 "isCorrect" BOOLEAN,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MistakeRetry_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "Mistake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MistakeRetry_mistakeId_createdAt_idx" ON "MistakeRetry"("mistakeId","createdAt");
