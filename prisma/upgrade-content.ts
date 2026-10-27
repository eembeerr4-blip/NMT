import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
dotenv.config({quiet:true});
const mode=process.argv[2];
if(!["--audit","--production"].includes(mode))throw new Error("Specify --audit or --production");
if(mode==="--audit")process.env.DATABASE_URL="file:./audit-20261017.e2e.db";
const db=new PrismaClient();
const exercises=[
  ["Знайдіть 20% від 150. Свій результат запишіть числом.",30,"150·20:100=30."],
  ["Знайдіть 5% від 240.",12,"240·0,05=12."],
  ["Який відсоток від 80 становить число 20?",25,"20:80·100=25%."],
  ["Ціна 200 грн. Знижка 10%. Знайдіть нову ціну у гривнях.",180,"200·0,9=180 грн."],
  ["Число 45 становить 15% від невідомого числа. Знайдіть це число.",300,"45:0,15=300."],
  ["Ціну підвищили на 20% й отримали 360 грн. Знайдіть початкову ціну у гривнях.",300,"360:1,2=300 грн."],
  ["Знайдіть x з пропорції 3:5=x:35.",21,"3·35=5x, тому x=105:5=21."],
  ["Ціна 800 грн зменшилася на 15%. Знайдіть нову ціну у гривнях.",680,"800·0,85=680 грн."],
  ["За 6 однакових зошитів заплатили 108 грн. Скільки гривень коштують 5 таких зошитів?",90,"Один коштує 108:6=18 грн, п’ять — 18·5=90 грн."],
  ["Ціну 100 грн спочатку підвищили на 20%, а потім знизили на 20%. Знайдіть кінцеву ціну у гривнях.",96,"База другої зміни — 120 грн. 100·1,2·0,8=96 грн."],
  ["Частка правильних відповідей зросла з 20% до 30%. На скільки відсотків відносно початкової частки вона зросла? Запишіть число без знака %.",50,"(30−20):20·100=50%. Різниця у відсоткових пунктах дорівнює 10."],
  ["Після двох послідовних підвищень ціни на 10% вартість стала 242 грн. Знайдіть початкову ціну у гривнях.",200,"Коефіцієнт двох підвищень 1,1²=1,21. 242:1,21=200 грн."]
] as const;

async function run(){
  const backup=path.resolve("prisma/backups/"+(mode==="--audit"?"audit":"production")+"-before-content-"+Date.now()+".db");
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  await db.$executeRawUnsafe("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
  const pack=JSON.parse(fs.readFileSync(path.resolve("prisma/content/foundation-lessons.json"),"utf8")) as {topicId:string;theory:string;prerequisites:string[];sources:{title:string;url:string}[];examples:{task:string;solution:string}[]}[];
  const personalBefore=await Promise.all([db.user.count(),db.testAttempt.count(),db.examResult.count(),db.answer.count()]);
  await db.$transaction(async tx=>{
    for(const entry of pack){
      const topic=await tx.topic.findUniqueOrThrow({where:{id:entry.topicId}});
      const previous=JSON.parse(topic.lessonJson||"{}");
      // Keep the original lesson, examples and objectives; replace only this authored foundation explanation.
      await tx.topic.update({where:{id:topic.id},data:{lessonJson:JSON.stringify({...previous,...entry,topicId:undefined})}});
    }
    for(let index=0;index<exercises.length;index++){
      const [prompt,answer,explanation]=exercises[index];const id="foundation-percent-v1-"+String(index+1).padStart(2,"0");
      await tx.question.upsert({where:{id},update:{},create:{id,subjectId:"math",topicId:"math-numbers",type:"NUMERIC",difficulty:index<4?"EASY":index<9?"MEDIUM":"HARD",prompt,correctAnswer:String(answer),explanation,source:"Авторська арифметична вправа NMT Academy; відповідь перевірено обчисленням. Не офіційне завдання НМТ.",verificationStatus:"VERIFIED"}});
    }
    // Public videos are candidates, not a claim that embedding and the whole lecture have been reviewed.
    for(const video of [{topicId:"math-linear-eq",youtubeId:"hoM0AHKTc7k",title:"ВШО: Лінійне рівняння з однією змінною"},{topicId:"ukr-ortho",youtubeId:"uDffUp7AuYQ",title:"ВШО: Орфографія (9 клас)"}]){
      if(!await tx.videoLesson.findFirst({where:{topicId:video.topicId,youtubeId:video.youtubeId}}))await tx.videoLesson.create({data:{...video,url:"https://www.youtube.com/watch?v="+video.youtubeId,channel:"Всеукраїнська школа онлайн",reviewStatus:"SUGGESTED",isPrimary:false}});
    }
  });
  const personalAfter=await Promise.all([db.user.count(),db.testAttempt.count(),db.examResult.count(),db.answer.count()]);
  if(JSON.stringify(personalBefore)!==JSON.stringify(personalAfter))throw new Error("Personal records changed unexpectedly");
  console.log(JSON.stringify({backup,lessons:pack.length,newExercises:exercises.length,personalCounts:personalAfter,integrity:await db.$queryRawUnsafe("PRAGMA integrity_check")}));
}
run().finally(()=>db.$disconnect());
