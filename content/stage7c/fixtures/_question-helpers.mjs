export const LABELS = ["А", "Б", "В", "Г"];

export function optionsFromTexts(texts) {
  return LABELS.map((label, i) => ({ label, text: texts[i] }));
}

/** @param {string} topicId @param {string} suffix e01 @param {string} difficulty */
export function q(topicId, suffix, difficulty, prompt, correctAnswer, optionTexts, explanation) {
  return {
    code: `s7a-${topicId}-${suffix}`,
    type: "SINGLE_CHOICE",
    difficulty,
    prompt,
    explanation,
    correctAnswer,
    options: optionsFromTexts(optionTexts),
  };
}
