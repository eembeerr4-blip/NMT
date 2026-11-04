-- Additive only. No existing content, account or calendar rows are changed.
CREATE TABLE "ExternalPractice" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
 "provider" TEXT NOT NULL DEFAULT 'ZNO_ONLINE', "variantNumber" INTEGER NOT NULL,
 "title" TEXT NOT NULL, "url" TEXT NOT NULL, "questionCount" INTEGER NOT NULL,
 "initialDate" TEXT NOT NULL, "taskId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PLANNED',
 "resultId" TEXT, "version" INTEGER NOT NULL DEFAULT 0,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "ExternalPractice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExternalPractice_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "StudyTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExternalPractice_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExamResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExternalPractice_taskId_key" ON "ExternalPractice"("taskId");
CREATE UNIQUE INDEX "ExternalPractice_resultId_key" ON "ExternalPractice"("resultId");
CREATE UNIQUE INDEX "ExternalPractice_userId_subjectId_variantNumber_key" ON "ExternalPractice"("userId","subjectId","variantNumber");
CREATE INDEX "ExternalPractice_userId_status_idx" ON "ExternalPractice"("userId","status");
CREATE TABLE "ExternalResultRevision" (
 "id" TEXT NOT NULL PRIMARY KEY, "assignmentId" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "snapshotJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ExternalResultRevision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ExternalPractice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExternalResultRevision_assignmentId_version_key" ON "ExternalResultRevision"("assignmentId","version");
