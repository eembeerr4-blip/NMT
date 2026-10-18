-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Flashcard_userId_dueKey_idx" ON "Flashcard"("userId", "dueKey");

-- CreateIndex
CREATE INDEX "Mistake_userId_status_idx" ON "Mistake"("userId", "status");

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "ReviewSchedule_userId_dueKey_status_idx" ON "ReviewSchedule"("userId", "dueKey", "status");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_status_idx" ON "TestAttempt"("userId", "status");

-- CreateIndex
CREATE INDEX "TopicDependency_prerequisiteId_idx" ON "TopicDependency"("prerequisiteId");

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");
