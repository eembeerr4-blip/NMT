import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import dotenv from "dotenv";
import {PrismaClient,type Prisma} from "@prisma/client";
import {loadMathContent,type MathContent} from "../src/lib/math-content";
import {prepareQuestion} from "../src/lib/question-input";
import {lessonReadiness} from "../src/lib/readiness";
import {verifyMathContent} from "../scripts/verify-math-content";

type Client=Prisma.TransactionClient;
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function personalCounts(db:Client){return Promise.all([db.user.count(),db.session.count(),db.userSettings.count(),db.userSubject.count(),db.testAttempt.count(),db.answer.count(),db.examResult.count(),db.studyTask.count(),db.userTopicProgress.count(),db.flashcard.count(),db.mistake.count(),db.studySession.count(),db.reviewSchedule.count()]);}
async function otherSubjectsHash(db:Client){return digest(await Promise.all([db.subject.findMany({where:{id:{not:"math"}},orderBy:{id:"asc"}}),db.topic.findMany({where:{subjectId:{not:"math"}},orderBy:{id:"asc"},include:{videos:{orderBy:{id:"asc"}}}}),db.question.findMany({where:{subjectId:{not:"math"}},orderBy:{id:"asc"},include:{options:{orderBy:{id:"asc"}}}})]));}
async function oldMathHash(db:Client,ids:string[]){return digest(await db.question.findMany({where:{id:{in:ids}},orderBy:{id:"asc"},include:{options:{orderBy:{id:"asc"}}}}));}
async function protectedHash(db:Client,ids:string[]){return digest(await db.topic.findMany({where:{id:{in:ids}},orderBy:{id:"asc"}}));}

export async function applyMathContent(db:PrismaClient,content:MathContent){
 const verification=verifyMathContent(content);
 const before={mathQuestions:await db.question.count({where:{subjectId:"math"}}),allTopics:await db.topic.count(),personal:await personalCounts(db),otherSubjects:await otherSubjectsHash(db),protectedTopics:await protectedHash(db,content.protectedTopicIds)};
 const oldIds=(await db.question.findMany({where:{subjectId:"math"},select:{id:true}})).map(q=>q.id);const oldQuestions=await oldMathHash(db,oldIds);
 let created=0,lessonsUpdated=0,skipped=0;
 await db.$transaction(async tx=>{
  for(const entry of content.packs){
   if(content.protectedTopicIds.includes(entry.topicId))throw new Error("STOP: protected topic in pack");
   const topic=await tx.topic.findUniqueOrThrow({where:{id:entry.topicId},include:{children:{select:{id:true}},questions:{where:{verificationStatus:"VERIFIED"},select:{difficulty:true}},videos:{select:{reviewStatus:true}}}});
   if(topic.subjectId!=="math"||topic.children.length)throw new Error("STOP: wrong subject or structural section");
   const readiness=lessonReadiness(topic);
   if(readiness.theory&&readiness.examples&&readiness.practice)throw new Error("STOP: refusing to overwrite already complete lesson "+topic.id);
   if(!(readiness.theory&&readiness.examples)){
    await tx.topic.update({where:{id:topic.id},data:{lessonJson:JSON.stringify(entry.lesson),coverage:"PARTIAL"}});lessonsUpdated++;
   }
   for(const q of entry.questions){
    if(await tx.question.findUnique({where:{id:q.id}})){skipped++;continue;}
    const prepared=prepareQuestion(q);const {options,...data}=prepared;
    await tx.question.upsert({where:{id:q.id},update:{},create:{...data,id:q.id,generatedByAi:true,verificationStatus:"DRAFT",options:{create:options}}});created++;
   }
  }
  if(await otherSubjectsHash(tx)!==before.otherSubjects||await protectedHash(tx,content.protectedTopicIds)!==before.protectedTopics||await oldMathHash(tx,oldIds)!==oldQuestions||digest(await personalCounts(tx))!==digest(before.personal)||await tx.topic.count()!==before.allTopics)throw new Error("STOP: preservation check failed; transaction rolled back");
 },{timeout:60000,maxWait:10000});
 return {verification,created,skipped,lessonsUpdated,flashcardTemplates:content.packs.reduce((n,p)=>n+p.flashcardTemplates.length,0),before:{mathQuestions:before.mathQuestions,allTopics:before.allTopics},after:{mathQuestions:await db.question.count({where:{subjectId:"math"}}),allTopics:await db.topic.count()},preserved:{oldQuestions:true,otherSubjects:true,protectedTopics:true,personalData:true}};
}

async function main(){
 dotenv.config({quiet:true});const mode=process.argv[2];if(!["--test","--production"].includes(mode))throw new Error("Specify --test or --production");
 const url=process.env.DATABASE_URL??"";if(!/^file:[A-Za-z]:\//.test(url))throw new Error("Absolute DATABASE_URL with forward slashes is required");
 const file=path.resolve(url.slice(5));const prismaDir=path.resolve("prisma");if(path.dirname(file)!==prismaDir)throw new Error("Database must be in this project's prisma folder");
 if(mode==="--test"&&!/^math-content-.*\.e2e\.db$/.test(path.basename(file)))throw new Error("Test mode requires math-content-*.e2e.db");
 if(mode==="--production"&&path.basename(file)!=="dev.db")throw new Error("Production mode accepts only existing dev.db");
 if(!fs.existsSync(file))throw new Error("Database must already exist and be seeded");
 const db=new PrismaClient({datasources:{db:{url}}});let backup:string|undefined;
 try{
  const content=loadMathContent();verifyMathContent(content);
  if(mode==="--production"){
   backup=path.resolve("prisma/dev.db.pre-content-20261018");if(fs.existsSync(backup))throw new Error("Refusing to overwrite existing pre-content backup");
   await db.$executeRawUnsafe("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
   const check=new PrismaClient({datasources:{db:{url:"file:"+backup.replaceAll("\\","/")}}});try{const integrity=await check.$queryRawUnsafe<{integrity_check:string}[]>("PRAGMA integrity_check");if(integrity.length!==1||integrity[0].integrity_check!=="ok")throw new Error("STOP: backup integrity check failed");}finally{await check.$disconnect();}
  }
  console.log(JSON.stringify({backup,...await applyMathContent(db,content),integrity:await db.$queryRawUnsafe("PRAGMA integrity_check"),foreignKeys:await db.$queryRawUnsafe("PRAGMA foreign_key_check")},null,2));
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error);process.exitCode=1;});
