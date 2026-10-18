import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { lessonReadiness } from "../src/lib/readiness";
dotenv.config({quiet:true});
const db=new PrismaClient();
async function run(){
  const topics=await db.topic.findMany({include:{subject:true,children:{select:{id:true}},questions:{where:{verificationStatus:"VERIFIED"},select:{difficulty:true}},videos:{select:{reviewStatus:true}}},orderBy:[{subjectId:"asc"},{sortOrder:"asc"}]});
  const rows=topics.map(topic=>({id:topic.id,subject:topic.subject.name,title:topic.title,...lessonReadiness(topic)}));
  console.log(JSON.stringify({summary:{topics:rows.length,sections:rows.filter(t=>t.section).length,expandedTheory:rows.filter(t=>!t.section&&t.theory).length,balancedPractice:rows.filter(t=>!t.section&&t.practice).length,confirmedVideo:rows.filter(t=>!t.section&&t.video).length,completePacks:rows.filter(t=>t.ready).length},topics:rows},null,2));
  if(process.argv.includes("--strict")&&rows.some(t=>!t.section&&!t.ready))process.exitCode=1;
}
run().finally(()=>db.$disconnect());
