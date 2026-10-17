export const PERSONAL_PLAN_CONFIG = {
  priority: {
    baselineWeight: 1,
    pointsPerGapWeight: 25,
    maxCountedGap: 100,
    errorsPerWeight: 10,
    maxCountedErrors: 20,
  },
  schedule: {
    minimumDailyMinutes: 30,
    maximumDailyMinutes: 240,
    minutesPerBlock: 30,
    minimumBlocksPerStudyDay: 2,
    maximumBlocksPerStudyDay: 4,
    minimumStudyDays: 2,
  },
} as const;
