export type GradeInput = {
  type: string;
  correctAnswer: string;
  userAnswer: unknown;
};

export type GradeOutput = {
  isCorrect: boolean | null;
  needsManualReview: boolean;
};

export function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ");
}

export function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = normalizeText(value).replace(/\s/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numbersClose(a: number, b: number) {
  return Math.abs(a - b) <= 1e-6;
}

function acceptableTexts(correctAnswer: string) {
  const raw = correctAnswer.trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => normalizeText(String(item)));
    } catch {
      return [normalizeText(raw)];
    }
  }
  return raw.split("|").map((item) => normalizeText(item)).filter(Boolean);
}

function isBlank(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

export function gradeAnswer(input: GradeInput): GradeOutput {
  const { type, correctAnswer, userAnswer } = input;
  if (type === "SINGLE_CHOICE") {
    if (typeof userAnswer !== "string" || !userAnswer) return { isCorrect: false, needsManualReview: false };
    return { isCorrect: userAnswer === correctAnswer, needsManualReview: false };
  }
  if (type === "NUMERIC") {
    const expected = parseNumber(correctAnswer);
    const actual = parseNumber(userAnswer);
    if (expected === null || actual === null) return { isCorrect: false, needsManualReview: false };
    return { isCorrect: numbersClose(expected, actual), needsManualReview: false };
  }
  if (type === "SEQUENCE") {
    let expected: string[] = [];
    try {
      expected = JSON.parse(correctAnswer) as string[];
    } catch {
      expected = [];
    }
    const actual = Array.isArray(userAnswer) ? userAnswer.map(String) : [];
    if (actual.length === 0) return { isCorrect: false, needsManualReview: false };
    const same = expected.length === actual.length && expected.every((id, index) => id === actual[index]);
    return { isCorrect: same, needsManualReview: false };
  }
  if (type === "MATCHING") {
    let expected: Record<string, string> = {};
    try {
      expected = JSON.parse(correctAnswer) as Record<string, string>;
    } catch {
      expected = {};
    }
    const actual = userAnswer && typeof userAnswer === "object" && !Array.isArray(userAnswer) ? (userAnswer as Record<string, string>) : {};
    const keys = Object.keys(expected);
    if (keys.some((key) => !actual[key])) return { isCorrect: false, needsManualReview: false };
    const same = keys.every((key) => actual[key] === expected[key]);
    return { isCorrect: same, needsManualReview: false };
  }
  if (type === "SHORT_TEXT") {
    const text = typeof userAnswer === "string" ? userAnswer : "";
    if (!text.trim()) return { isCorrect: false, needsManualReview: false };
    const accepted = acceptableTexts(correctAnswer);
    if (accepted.includes(normalizeText(text))) return { isCorrect: true, needsManualReview: false };
    return { isCorrect: null, needsManualReview: true };
  }
  if (type === "STEP_BY_STEP") {
    const finalAnswer =
      userAnswer && typeof userAnswer === "object" && "final" in (userAnswer as object)
        ? String((userAnswer as { final?: string }).final ?? "")
        : typeof userAnswer === "string"
          ? userAnswer
          : "";
    if (!finalAnswer.trim()) return { isCorrect: false, needsManualReview: false };
    const expectedNumber = parseNumber(correctAnswer);
    const actualNumber = parseNumber(finalAnswer);
    if (expectedNumber !== null && actualNumber !== null) {
      return { isCorrect: numbersClose(expectedNumber, actualNumber), needsManualReview: false };
    }
    if (acceptableTexts(correctAnswer).includes(normalizeText(finalAnswer))) {
      return { isCorrect: true, needsManualReview: false };
    }
    return { isCorrect: null, needsManualReview: true };
  }
  if (isBlank(userAnswer)) return { isCorrect: false, needsManualReview: false };
  return { isCorrect: null, needsManualReview: true };
}

export function pickBalanced<T extends { id: string; difficulty: string }>(
  questions: T[],
  targets: { EASY: number; MEDIUM: number; HARD: number } = { EASY: 4, MEDIUM: 5, HARD: 3 },
) {
  const buckets: Record<string, T[]> = { EASY: [], MEDIUM: [], HARD: [] };
  for (const question of questions) {
    (buckets[question.difficulty] ??= []).push(question);
  }
  const picked: T[] = [];
  (["EASY", "MEDIUM", "HARD"] as const).forEach((level) => {
    const pool = shuffle(buckets[level] ?? []);
    picked.push(...pool.slice(0, targets[level]));
  });
  const targetTotal = targets.EASY + targets.MEDIUM + targets.HARD;
  if (picked.length < targetTotal) {
    const used = new Set(picked.map((question) => question.id));
    const rest = shuffle(questions.filter((question) => !used.has(question.id)));
    picked.push(...rest.slice(0, targetTotal - picked.length));
  }
  return {
    questions: shuffle(picked),
    requested: targetTotal,
    shortfall: Math.max(0, targetTotal - picked.length),
  };
}

export function stableShuffle<T>(items: T[], seed: string) {
  const copy = [...items];
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822519);
    const swap = (hash >>> 0) % (index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
