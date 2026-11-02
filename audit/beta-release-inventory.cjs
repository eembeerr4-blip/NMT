const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('@playwright/test');
const {PrismaClient}=require('@prisma/client');
const {DatabaseSync}=require('node:sqlite');
const root=process.cwd();if(!root.endsWith('nmt-beta'))throw Error('QA worktree only');
const database=path.join(root,'audit/tests/beta-chrome.db');
const base='http://127.0.0.1:3100';
const output=path.join(root,'design/screenshots/06-final-inventory');fs.mkdirSync(output,{recursive:true});
const sha=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const student=['/','/curriculum','/subjects','/subjects/math','/topics/qa-linear','/learn/qa-linear','/learn/QA-unavailable','/tests','/tests/qa-attempt-a','/tests/QA-finished','/results','/analytics','/calendar','/mistakes','/notes','/review','/exams','/settings','/search?q=QA','/ai-tutor'];
const admin=['/admin','/admin/users','/admin/subjects','/admin/subjects/math','/admin/topics','/admin/topics/qa-linear','/admin/lessons','/admin/lessons/qa-linear','/admin/questions','/admin/questions/qa-unused-NUMERIC','/admin/tasks','/admin/tests','/admin/tests/qa-test','/admin/tests/new?subject=math','/admin/settings','/admin/audit'];
const editor=['/editor','/editor/subjects','/editor/subjects/math','/editor/topics','/editor/topics/qa-linear','/editor/lessons','/editor/lessons/qa-linear','/editor/questions','/editor/questions/qa-unused-NUMERIC'];
const empty=['/results','/analytics','/mistakes','/notes','/review','/calendar?view=day&date=2028-01-01'];
const roles=[['student_a',student,'data'],['student_b',empty,'empty'],['owner',admin,'data'],['qa_editor',editor,'data'],[null,['/login','/onboarding'],'anonymous']];
const rows=[];let browser;
async function capture(page,role,url,state,theme,width){
 const errors=[];const listener=error=>errors.push(error.message);page.on('pageerror',listener);
 const response=await page.goto(base+url,{waitUntil:'networkidle',timeout:30000});
 const main=page.locator('main').first();if(await main.count())await main.waitFor({state:'visible',timeout:15000});
 const name=`${role??'ANON'}-${state}-${theme}-${width}-${url.replace(/[^a-zA-Z0-9]+/g,'_')||'home'}.png`;
 await page.screenshot({path:path.join(output,name),fullPage:true,animations:'disabled',timeout:20000});
 const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.className,headings:[...document.querySelectorAll('h1,h2')].map(el=>el.textContent),body:document.body.innerText.slice(0,14000),overflow:[...document.querySelectorAll('main *')].map(el=>({tag:el.tagName,className:typeof el.className==='string'?el.className:'',rect:el.getBoundingClientRect(),style:getComputedStyle(el)})).filter(item=>item.rect.width>0&&item.style.visibility!=='hidden'&&item.style.display!=='none'&&(item.rect.right>innerWidth+2||item.rect.left<-2)).slice(0,15).map(item=>({tag:item.tag,className:item.className,right:Math.round(item.rect.right),left:Math.round(item.rect.left)}))}));
 page.off('pageerror',listener);
 rows.push({role,state,route:url,url:page.url(),theme,width,status:response?.status(),file:path.relative(root,path.join(output,name)),errors,...metrics});
 fs.writeFileSync('audit/reports/06-final-inventory.json',JSON.stringify({sha,captures:rows.length,rows},null,2));
 if(rows.length%20===0)console.log(`${rows.length} captures; last ${url} ${width} ${theme}`);
}
async function main(){
 const db=new PrismaClient({datasourceUrl:'file:'+database.replaceAll('\\','/')});
 await db.topic.upsert({where:{id:'QA-unavailable'},update:{},create:{id:'QA-unavailable',subjectId:'math',title:'QA-Матеріал готується',sortOrder:999}});
 await db.testAttempt.upsert({where:{id:'QA-finished'},update:{},create:{id:'QA-finished',testId:'qa-test',userId:'student_a',status:'COMPLETED',finishedAt:new Date(),durationSec:90,correctCount:2,totalCount:3,pendingCount:0,percent:200/3,answers:{create:[1,2,3].map(n=>({questionId:'qa-q'+n,userAnswer:JSON.stringify(n===1?'2':'3'),isCorrect:n!==1}))}}});
 await db.mistake.upsert({where:{id:'QA-mistake'},update:{},create:{id:'QA-mistake',userId:'student_a',subjectId:'math',topicId:'qa-linear',questionId:'qa-q1',prompt:'QA-Знайдіть x: x + 1 = 4',userAnswer:'2',correctAnswer:'3',explanation:'Відніміть 1 від обох частин рівняння.'}});
 await db.$disconnect();
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const theme of ['light','dark'])for(const [role,routes,state]of roles){
  const context=await browser.newContext({colorScheme:theme});await context.addInitScript(value=>localStorage.setItem('theme',value),theme);const page=await context.newPage();
  if(role){await page.goto(base+'/login');await page.getByLabel('Нікнейм',{exact:true}).fill(role);await page.getByLabel('Пароль',{exact:true}).fill('Nmt-Ui-QA-Only-2026');await page.getByRole('button',{name:'Увійти',exact:true}).click();await page.waitForURL(base+'/');}
  for(const width of [390,768,1280,1920]){await page.setViewportSize({width,height:900});for(const url of routes)await capture(page,role,url,state,theme,width);}
  if(role==='student_b'){
   const sqlite=new DatabaseSync(database);sqlite.exec('PRAGMA busy_timeout=5000');const original=sqlite.prepare("SELECT scheduleJson FROM UserSettings WHERE userId='student_b'").get().scheduleJson;
   try{sqlite.prepare("UPDATE UserSettings SET scheduleJson=? WHERE userId='student_b'").run('QA-invalid-json');for(const width of [390,768,1280,1920]){await page.setViewportSize({width,height:900});await capture(page,role,'/','inherited-error',theme,width);}}
   finally{sqlite.prepare("UPDATE UserSettings SET scheduleJson=? WHERE userId='student_b'").run(original);sqlite.close();}
  }
  await context.close();
 }
 console.log(JSON.stringify({sha,captures:rows.length,overflowCaptures:rows.filter(row=>row.overflow.length).length,pageErrors:rows.filter(row=>row.errors.length).length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
