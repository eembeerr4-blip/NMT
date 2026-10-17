import { PrismaClient } from "@prisma/client";

async function main() {
const prisma = new PrismaClient();
const subjects = await prisma.subject.findMany({ orderBy: { sortOrder: "asc" } });
const topics = await prisma.topic.findMany();
const questions = await prisma.question.findMany({ where: { verificationStatus: "VERIFIED" } });
const videos = await prisma.videoLesson.findMany();
const exams = await prisma.examResult.findMany({ where: { id: { startsWith: "seed-" } }, select: { id: true, subjectId: true, ratingScore: true, rawScore: true, partial: true, belowThreshold: true } });
console.log("seed exams", exams.length);
for (const exam of exams) console.log(exam.id, exam.subjectId, exam.rawScore, exam.ratingScore, exam.partial, exam.belowThreshold);
for (const subject of subjects) {
  const own = topics.filter((topic) => topic.subjectId === subject.id);
  const withLesson = own.filter((topic) => topic.lessonJson.length > 20 && topic.coverage === "VERIFIED");
  const withVideo = own.filter((topic) => videos.some((video) => video.topicId === topic.id && video.reviewStatus !== "REJECTED"));
  const withPractice = own.filter((topic) => questions.filter((question) => question.topicId === topic.id).length >= 4);
  const questionCount = questions.filter((question) => question.subjectId === subject.id).length;
  console.log([subject.id, own.length, withLesson.length, withVideo.length, questionCount, withPractice.length, own.filter((topic) => topic.coverage === "NEEDS_CONTENT").length].join("\t"));
}
await prisma.$disconnect();
}
main();
