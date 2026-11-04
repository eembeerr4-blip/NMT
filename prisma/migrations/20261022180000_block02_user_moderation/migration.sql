-- Block 2: owner moderation for new registrations. Existing profiles stay approved.
ALTER TABLE "User" ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'PENDING';
UPDATE "User" SET "accountStatus" = 'APPROVED';
