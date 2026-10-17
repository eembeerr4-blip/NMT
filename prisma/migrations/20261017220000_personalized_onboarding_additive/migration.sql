ALTER TABLE "User" ADD COLUMN "onboardingStep" TEXT NOT NULL DEFAULT 'PROFILE';
ALTER TABLE "User" ADD COLUMN "planVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "UserSubject" ADD COLUMN "targetScore" INTEGER;

ALTER TABLE "ExamResult" ADD COLUMN "isBaseline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamResult" ADD COLUMN "baselineKey" TEXT;
CREATE UNIQUE INDEX "ExamResult_baselineKey_key" ON "ExamResult"("baselineKey");
