import { lessonAccess } from "./readiness";

type LearnerQuestion = {
  verificationStatus: string;
  topic: { coverage: string; lessonJson: string } | null;
};
// Unattached questions have no publication decision: fail closed, including history.
export function learnerQuestionAvailable(question: LearnerQuestion) {
  return question.verificationStatus === "VERIFIED" && question.topic !== null &&
    lessonAccess({ ...question.topic, questions: [question] }).practice;
}
export function learnerTestAvailable(test: { questions: { question: LearnerQuestion }[] }) {
  return test.questions.length > 0 && test.questions.every(row => learnerQuestionAvailable(row.question));
}
export const unavailableTestMessage = "Матеріали цієї спроби зараз недоступні. Збережені результати не видалено.";
