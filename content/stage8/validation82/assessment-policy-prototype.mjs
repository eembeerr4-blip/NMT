// Historical QA-only proposal. Production guards live in src/server/assessment.ts.
// This proposal is not imported by the application or connected to Prisma.
const week = 7 * 24 * 60 * 60 * 1000;
const success = a => a.status === 'COMPLETED' && a.pendingCount === 0 &&
  Number.isInteger(a.totalCount) && a.totalCount > 0 &&
  Number.isInteger(a.correctCount) && a.correctCount >= Math.ceil(0.8 * a.totalCount) && a.correctCount <= a.totalCount;
const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const disjoint = (a, b) => !a.some(id => b.includes(id));
function scoped(attempts, userId, topicId) {
  return [...new Map(attempts.filter(a => a.userId === userId && a.topicId === topicId).map(a => [a.id, a])).values()];
}
export function proposedMastery({ userId, topicId, attempts }) {
  const valid = scoped(attempts, userId, topicId).filter(success);
  for (const first of valid.filter(a => a.purpose === 'FINAL')) {
    const at = time(first.completedAt);
    if (at === null) continue;
    for (const delayed of valid.filter(a => a.purpose === 'DELAYED')) {
      const later = time(delayed.completedAt);
      if (delayed.id !== first.id && later !== null && later - at >= week &&
          first.questionIds.length === first.totalCount && delayed.questionIds.length === delayed.totalCount &&
          new Set(first.questionIds).size === first.questionIds.length &&
          new Set(delayed.questionIds).size === delayed.questionIds.length &&
          disjoint(first.questionIds, delayed.questionIds)) return { mastered: true, evidence: [first.id, delayed.id] };
    }
  }
  return { mastered: false, evidence: [] };
}
export function proposedStart({ userId, topicId, purpose, questionIds, trainingQuestionIds, attempts, now }) {
  if (!['FINAL', 'DELAYED'].includes(purpose) || !questionIds.length || new Set(questionIds).size !== questionIds.length)
    return { allowed: false, reason: 'INVALID_CONTROL_SET' };
  if (!disjoint(questionIds, trainingQuestionIds)) return { allowed: false, reason: 'TRAINING_OVERLAP' };
  const history = scoped(attempts, userId, topicId);
  if (history.some(a => !disjoint(questionIds, a.questionIds))) return { allowed: false, reason: 'ALREADY_EXPOSED' };
  if (purpose === 'DELAYED') {
    const clock = time(now);
    if (clock === null || !history.some(a => a.purpose === 'FINAL' && success(a) && time(a.completedAt) !== null && clock - time(a.completedAt) >= week))
      return { allowed: false, reason: 'DELAY_NOT_REACHED' };
  }
  return { allowed: true };
}
export function proposedNextTopic({ prerequisiteIds, masteredTopicIds }) {
  const missing = prerequisiteIds.filter(id => !masteredTopicIds.includes(id));
  return { allowed: missing.length === 0, missing };
}
