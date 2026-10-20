-- Existing verification and reset tokens remain valid; targetEmail is only for explicit email linking.
ALTER TABLE "AuthToken" ADD COLUMN "targetEmail" TEXT;
