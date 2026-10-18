import { parseLesson } from "./lesson";
type TopicInput={ lessonJson:string; children?:unknown[]; questions:{difficulty:string}[]; videos:{reviewStatus:string}[] };
export function lessonReadiness(topic:TopicInput){
 const lesson=parseLesson(topic.lessonJson);
 const theory=Boolean(lesson&&lesson.theory.trim().length>=600&&lesson.objectives.length&&lesson.rules.length&&lesson.mistakes.length&&lesson.summary.trim());
 const examples=Boolean(lesson&&lesson.examples.length>=2);
 const counts={EASY:0,MEDIUM:0,HARD:0};for(const q of topic.questions){if(q.difficulty in counts)counts[q.difficulty as keyof typeof counts]++;}
 const practice=counts.EASY>=4&&counts.MEDIUM>=5&&counts.HARD>=3;
 const video=topic.videos.some(v=>v.reviewStatus==='CONFIRMED');
 const section=Boolean(topic.children?.length);
 return {theory,examples,practice,video,counts,section,ready:!section&&theory&&examples&&practice&&video,canStudy:!section&&Boolean(lesson?.theory.trim()),questionCount:topic.questions.length};
}
