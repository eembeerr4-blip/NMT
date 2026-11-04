import { expect, it } from "vitest";
import { questions } from "../prisma/questions";
import { gradeAnswer } from "@/lib/grade";

it("q-u6 follows the 2019 spelling rule: пів яблука, without apostrophe or hyphen", () => {
  const question = questions.find(item => item.id === "q-u6")!;
  expect(question.options.find(option => option.id === question.correctAnswer)?.text).toBe("пів яблука");
  expect(question.explanation).toContain("пишемо окремо");
  for (const option of question.options) {
    expect(gradeAnswer({ type: question.type, correctAnswer: question.correctAnswer, userAnswer: option.id }).isCorrect).toBe(option.text === "пів яблука");
  }
});
