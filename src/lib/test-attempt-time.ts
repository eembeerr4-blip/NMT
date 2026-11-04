/** Grace after the limit so auto-finish from the client can still complete. */
export const ATTEMPT_FINISH_GRACE_SEC = 30;

export function attemptDeadlineMs(startedAt: Date, timeLimitSec: number | null): number | null {
  if (!timeLimitSec || timeLimitSec <= 0) return null;
  return startedAt.getTime() + timeLimitSec * 1000;
}

export function isAttemptExpired(startedAt: Date, timeLimitSec: number | null, now = Date.now()): boolean {
  const deadline = attemptDeadlineMs(startedAt, timeLimitSec);
  return deadline !== null && now > deadline;
}

export function canFinishAttemptAfterDeadline(startedAt: Date, timeLimitSec: number | null, now = Date.now()): boolean {
  const deadline = attemptDeadlineMs(startedAt, timeLimitSec);
  if (deadline === null) return true;
  return now <= deadline + ATTEMPT_FINISH_GRACE_SEC * 1000;
}
