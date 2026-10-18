import dotenv from "dotenv";
import {PrismaClient} from "@prisma/client";
import {lessonReadiness} from "../src/lib/readiness";
dotenv.config({quiet:true});
const args=process.argv.slice(2);const includeDrafts=args.includes("--include-drafts");const withoutVideo=args.includes("--without-video");const subjectIndex=args.indexOf("--subject");const subjectId=subjectIndex>=0?args[subjectIndex+1]:undefined;
if(subjectIndex>=0&&!subjectId)throw new Error("--subject requires an id");
const db=new PrismaClient();
async function run(){
 const topics=await db.topic.findMany({where:subjectId?{subjectId}:undefined,include:{subject:true,children:{select:{id:true}},questions:{where:{verificationStatus:{in:includeDrafts?["VERIFIED","DRAFT"]:["VERIFIED"]}},select:{difficulty:true,verificationStatus:true}},videos:{select:{reviewStatus:true}}},orderBy:[{subjectId:"asc"},{sortOrder:"asc"}]});
 const rows=topics.map(topic=>{
  const selected=lessonReadiness(topic);const published=lessonReadiness({...topic,questions:topic.questions.filter(q=>q.verificationStatus==="VERIFIED")});
  return {id:topic.id,subject:topic.subject.name,title:topic.title,...selected,ready:published.ready,publishablePractice:published.practice,draftQuestions:topic.questions.filter(q=>q.verificationStatus==="DRAFT").length,criteriaPass:!selected.section&&selected.theory&&selected.examples&&selected.practice&&(withoutVideo||selected.video)};
 });
 console.log(JSON.stringify({mode:{subjectId:subjectId??"all",includeDrafts,withoutVideo,note:includeDrafts?"Authoring audit only. DRAFT questions are not published or enabled in learner practice.":"Published VERIFIED questions only."},summary:{topics:rows.length,sections:rows.filter(t=>t.section).length,expandedTheory:rows.filter(t=>!t.section&&t.theory).length,balancedPractice:rows.filter(t=>!t.section&&t.practice).length,confirmedVideo:rows.filter(t=>!t.section&&t.video).length,completePacks:rows.filter(t=>t.ready).length,passingRequestedCriteria:rows.filter(t=>t.criteriaPass).length},topics:rows},null,2));
 if(args.includes("--strict")&&(rows.length===0||rows.some(t=>!t.section&&!t.criteriaPass)))process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
