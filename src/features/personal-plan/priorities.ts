import { PERSONAL_PLAN_CONFIG } from "./config";

export type SubjectPriorityInput = {
  subjectId: string;
  currentRating: number | null;
  targetRating: number | null;
  confirmedErrors: number;
};

export type SubjectPriority = SubjectPriorityInput & {
  weight: number;
  percent: number;
};

export function distributeStudyPriorities(inputs: SubjectPriorityInput[]): SubjectPriority[] {
  if (inputs.length === 0) return [];

  const weights = inputs.map((input) => {
    const gap = input.currentRating === null || input.targetRating === null
      ? 0
      : Math.max(0, input.targetRating - input.currentRating);
    const config = PERSONAL_PLAN_CONFIG.priority;
    return config.baselineWeight
      + Math.min(gap, config.maxCountedGap) / config.pointsPerGapWeight
      + Math.min(Math.max(0, input.confirmedErrors), config.maxCountedErrors) / config.errorsPerWeight;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight / total) * 100);
  const rounded = exact.map(Math.floor);
  let remainder = 100 - rounded.reduce((sum, percent) => sum + percent, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - rounded[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let index = 0; remainder > 0; index += 1, remainder -= 1) {
    rounded[order[index % order.length].index] += 1;
  }

  return inputs.map((input, index) => ({
    ...input,
    weight: weights[index],
    percent: rounded[index],
  }));
}

export function priorityExplanation(priority: SubjectPriority, priorities: SubjectPriority[]) {
  if (priority.currentRating === null || priority.targetRating === null) return null;
  const largestKnownGap = Math.max(
    0,
    ...priorities
      .filter((item) => item.currentRating !== null && item.targetRating !== null)
      .map((item) => (item.targetRating as number) - (item.currentRating as number)),
  );
  const gap = priority.targetRating - priority.currentRating;
  if (gap <= 0 || gap !== largestKnownGap) return null;
  return `До цілі з цього предмета найбільша різниця серед відомих стартових результатів — ${gap} балів.`;
}
