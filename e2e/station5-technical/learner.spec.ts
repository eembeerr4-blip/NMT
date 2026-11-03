import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
const root = process.env.STATION5_PRIVATE_ROOT!;
const fixture = JSON.parse(readFileSync(path.join(root,'fixture-location.json'),'utf8'));
const folder = realpathSync(fixture.folder);
if (!fixture.station5 || !fixture.synthetic || path.dirname(folder)!==path.resolve(tmpdir()) || !path.basename(folder).startsWith('nmt-station5-') || path.resolve(fixture.database)!==path.join(folder,'qa.db')) throw Error('Disposable fixture required');
const db = new PrismaClient({datasourceUrl:'file:'+fixture.database.replaceAll('\\','/')+'?connection_limit=1'});
const artifacts = process.env.STATION5_ARTIFACTS!;
mkdirSync(artifacts,{recursive:true});
const outcomes: Record<string,unknown>[]=[];
test.afterAll(async()=>{ await db.$disconnect(); });
test.afterEach(async({}, info)=>{
  const file=path.join(root,'technical-browser-QA.json');
  const old=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{outcomes:[],runs:[]};
  const merged=new Map<string,Record<string,unknown>>([...old.outcomes,...outcomes].map(item=>[String(item.id??item.scope),item]));
  writeFileSync(file,JSON.stringify({outcomes:[...merged.values()],runs:[...(old.runs??[]),{test:info.title,status:info.status}],lastTest:info.title,lastStatus:info.status,productionAccessed:false,baselineSnapshotDate:fixture.snapshotDate,automatedAnswersUseFixtureKeys:true},null,2));
});
async function login(page:Page, nickname='s5_student') {
  await page.goto('/login');await page.getByLabel('Нікнейм або email',{exact:true}).fill(nickname);await page.getByLabel('Пароль',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'Увійти',exact:true}).click();await expect(page).not.toHaveURL(/\/login/);
}
async function noOverflow(page:Page) { expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true); }

test('route connects only available lessons across sections; all 20 candidates and private controls stay closed',async({page,browser})=>{
  const attemptsBefore=await db.testAttempt.count();
  await login(page);await page.goto('/subjects/ukrainian');
  const links=page.getByRole('list',{name:'Доступні уроки української мови'}).getByRole('link');await expect(links).toHaveCount(13);
  const ids=(await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')!.split('/').pop()!)));
  expect(new Set(ids)).toEqual(new Set(fixture.topics.map((t:{id:string})=>t.id)));
  expect(ids.indexOf('ukr-word')).toBeLessThan(ids.indexOf('ukr-phonetics'));expect(ids.indexOf('ukr-morph')).toBeLessThan(ids.indexOf('ukr-syntax'));
  await page.getByText('Чого поки бракує для навчання з нуля',{exact:true}).click();await expect(page.getByText(/Окремого вступу до стилів/)).toBeVisible();await noOverflow(page);
  for(const id of ids) {
    await page.goto(`/learn/${id}`);const index=ids.indexOf(id);const nav=page.getByRole('navigation',{name:'Перехід між темами'});
    if(index>0)await expect(nav.getByRole('link',{name:/Попередня тема/})).toHaveAttribute('href',`/learn/${ids[index-1]}`);
    if(index<ids.length-1)await expect(nav.getByRole('link',{name:/Наступна тема/})).toHaveAttribute('href',`/learn/${ids[index+1]}`);
  }
  // Click the actual cross-section transition, not only its href.
  await page.goto('/learn/ukr-lex-03-phraseology');await page.getByRole('navigation',{name:'Перехід між темами'}).getByRole('link',{name:/Наступна тема/}).click();await expect(page).toHaveURL(/\/learn\/ukr-morph$/);
  for(const t of fixture.candidates) {
    await page.goto(`/learn/${t.id}`);await expect(page.getByRole('heading',{name:'Матеріал готується',exact:true})).toBeVisible();await expect(page.getByRole('tab')).toHaveCount(0);expect(await page.content()).not.toContain('"correctAnswer"');
  }
  await page.goto('/tests');const html=await page.content();
  for(const kind of ['FINAL','DELAYED']) {expect(html).not.toContain('PRIVATE QA CONTROL '+kind);expect(html).not.toContain('qa-hidden-'+kind);}
  await expect(page.getByRole('button',{name:'Розпочати тест'})).toHaveCount(0);
  const outsider=await browser.newContext();const other=await outsider.newPage();await login(other,'s5_other');await other.goto('/tests/nonexistent-private-attempt');await expect(other.getByRole('heading',{name:'Сторінку не знайдено',exact:true})).toBeVisible();await outsider.close();
  expect(await db.testAttempt.count()).toBe(attemptsBefore);
  outcomes.push({scope:'route-and-access',status:'PASS',routeSteps:ids,candidatesDenied:20,privateControlsHidden:true});
});

test('continues after persisted practice while keeping review and mastery honest',async({page})=>{
  await db.userTopicProgress.upsert({where:{userId_topicId:{userId:'s5_other',topicId:'ukr-lexis'}},create:{userId:'s5_other',topicId:'ukr-lexis',status:'NEEDS_REVIEW',lastCorrect:3,lastTotal:4},update:{status:'NEEDS_REVIEW',lastCorrect:3,lastTotal:4}});
  await login(page,'s5_other');await page.goto('/subjects/ukrainian');
  await expect(page.getByText('Доступно для навчання: 13 із 13 тем.',{exact:true})).toBeVisible();
  const next=page.getByRole('link',{name:'Наступний доступний урок',exact:true});await expect(next).toHaveAttribute('href','/topics/ukr-lexicology-section-01');
  const first=page.getByRole('list',{name:'Доступні уроки української мови'}).getByRole('listitem').first();await expect(first).toContainText('Практику виконано');await expect(first).toContainText('Потрібне повторення');
  await next.click();await page.getByRole('link',{name:'Відкрити урок',exact:true}).click();await expect(page).toHaveURL(/\/learn\/ukr-lexicology-section-01$/);
  await page.goto('/subjects/ukrainian');await page.getByText('Чого поки бракує для навчання з нуля',{exact:true}).click();await noOverflow(page);await page.screenshot({path:path.join(artifacts,'route-mobile.png'),fullPage:true,caret:'initial'});
  await page.context().clearCookies();await login(page,'s5_other');await page.goto('/subjects/ukrainian');await expect(page.getByRole('link',{name:'Наступний доступний урок',exact:true})).toHaveAttribute('href','/topics/ukr-lexicology-section-01');
  expect((await db.userTopicProgress.findUniqueOrThrow({where:{userId_topicId:{userId:'s5_other',topicId:'ukr-lexis'}}})).status).toBe('NEEDS_REVIEW');
  outcomes.push({scope:'continue-after-practice',status:'PASS',masteryNotFabricated:true,reloginPersisted:true,horizontalOverflow:false});
});

for(const topic of fixture.topics as {id:string;title:string}[]) test(`lesson ${topic.id}: components, real practice, mistake correction and persisted progress`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);await page.goto('/subjects/ukrainian');
  await page.getByRole('list',{name:'Доступні уроки української мови'}).getByRole('link',{name:topic.title,exact:true}).click();
  await expect(page.getByRole('heading',{name:topic.title,exact:true})).toBeVisible();
  const row=await db.topic.findUniqueOrThrow({where:{id:topic.id}});const lesson=JSON.parse(row.lessonJson);
  await page.getByRole('tab',{name:'Теорія',exact:true}).click();await expect(page.getByRole('tabpanel').filter({visible:true})).toContainText(lesson.theory.replace(/^#+\s*/,'').replace(/\*\*/g,'').slice(0,25));await noOverflow(page);
  await page.getByRole('tab',{name:'Конспект',exact:true}).click();
  const synopsis=page.getByRole('tabpanel').filter({visible:true});
  const hasSynopsis=Boolean(lesson.summary?.trim()||lesson.rules?.length||lesson.mistakes?.length||lesson.notes?.trim()||row.formulas.trim());
  if(hasSynopsis) {await expect(synopsis).not.toContainText('Окремого короткого конспекту ще немає');await expect(synopsis).toContainText(lesson.summary?.trim()||lesson.rules[0]);}
  else await expect(synopsis).toContainText('конспекту ще немає');
  await noOverflow(page);await page.getByRole('tab',{name:'Приклади',exact:true}).click();await expect(page.getByRole('article')).toHaveCount(lesson.examples.length);
  await page.getByRole('button',{name:"Переглянути розв'язання",exact:true}).first().click();await expect(page.getByRole('heading',{name:'Розв’язання',exact:true}).first()).toBeVisible();await noOverflow(page);
  await page.getByRole('tab',{name:'Практика',exact:true}).click();await page.getByRole('button',{name:'Пройти тест',exact:true}).click();await expect(page).toHaveURL(/\/tests\/[^/]+$/);
  const attemptId=page.url().split('/').pop()!;const attempt=await db.testAttempt.findUniqueOrThrow({where:{id:attemptId},include:{test:{include:{questions:{orderBy:{sortOrder:'asc'},include:{question:{include:{options:true}}}}}}}});
  let wrongId='';const types=new Set<string>();
  for(let i=0;i<attempt.test.questions.length;i++) {
    const q=attempt.test.questions[i].question;types.add(q.type);expect(q.id.startsWith('qa-hidden-')).toBe(false);expect(q.topicId).toBe(topic.id);
    await expect(page.getByText(`Завдання ${i+1} з ${attempt.test.questions.length}`,{exact:true})).toBeVisible();expect(await page.content()).not.toContain('"correctAnswer"');
    if(q.type==='SINGLE_CHOICE') {
      const wrong=!wrongId;const option=q.options.find(o=>wrong?o.id!==q.correctAnswer:o.id===q.correctAnswer)!;
      await page.getByRole('radio',{name:new RegExp('^'+option.label+'\\.')}).check();if(wrong)wrongId=q.id;
    } else if(q.type==='MATCHING') {for(const [left,right] of Object.entries(JSON.parse(q.correctAnswer)))await page.locator(`[id="matching-${q.id}-${left}"]`).selectOption(String(right));}
    else if(q.type==='SHORT_TEXT') await page.getByLabel('Коротка відповідь',{exact:true}).fill(q.correctAnswer.split('|')[0]);
    else throw Error('Uncovered baseline question template: '+q.type);
    if(i===0) {
      await expect.poll(async()=>JSON.parse((await db.testAttempt.findUniqueOrThrow({where:{id:attemptId}})).draftJson)[q.id]).not.toBeUndefined();
      await page.reload();await expect(page.getByText(`Завдання 1 з ${attempt.test.questions.length}`,{exact:true})).toBeVisible();if(q.type==='SINGLE_CHOICE')await expect(page.getByRole('radio',{checked:true})).toHaveCount(1);
    }
    await noOverflow(page);if(i<attempt.test.questions.length-1)await page.getByRole('button',{name:'Далі',exact:true}).click();
  }
  expect(wrongId).not.toBe('');
  await page.getByRole('button',{name:'Завершити',exact:true}).click();await page.getByRole('button',{name:'Так, завершити тест',exact:true}).click();await expect(page.getByRole('heading',{name:'Результат',exact:true})).toBeVisible();
  const result=await db.testAttempt.findUniqueOrThrow({where:{id:attemptId}});expect(result.correctCount).toBe(attempt.test.questions.length-1);expect(result.pendingCount).toBe(0);await expect(page.locator('.d05-explanation')).toHaveCount(attempt.test.questions.length);await noOverflow(page);
  const mistake=await db.mistake.findFirstOrThrow({where:{userId:'s5_student',questionId:wrongId},include:{question:{include:{options:true}}}});
  await page.goto(`/mistakes/${mistake.id}/retry`);const correct=mistake.question!.options.find(o=>o.id===mistake.question!.correctAnswer)!;
  await page.getByRole('radio',{name:new RegExp('^'+correct.label+'\\.')}).check();await page.getByRole('button',{name:'Перевірити нову відповідь',exact:true}).click();await expect(page.getByRole('status')).toContainText('Помилку виправлено');
  await page.goto(`/learn/${topic.id}`);await page.getByRole('tab',{name:'Практика',exact:true}).click();await page.getByRole('button',{name:'Завершити урок',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Урок зараховано'})).toBeVisible();
  const saved=await db.userTopicProgress.findUniqueOrThrow({where:{userId_topicId:{userId:'s5_student',topicId:topic.id}}});expect(saved.status).not.toBe('NOT_STARTED');expect(saved.status).not.toBe('MASTERED');
  await page.context().clearCookies();await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await login(page);await page.goto(`/learn/${topic.id}`);await page.getByRole('tab',{name:'Практика',exact:true}).click();await expect(page.getByText('Переглянути розбір',{exact:true})).toBeVisible();await expect(page.getByText(/Наступне повторення:/)).toBeVisible();
  await page.getByText('Переглянути розбір',{exact:true}).click();await expect(page.getByRole('heading',{name:'Результат',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Результат',exact:true})).toBeVisible();await noOverflow(page);
  await page.screenshot({path:path.join(artifacts,topic.id+'-result-mobile.png'),fullPage:true,caret:'initial'});expect(errors).toEqual([]);
  outcomes.push({id:topic.id,status:'PASS',theoryChars:lesson.theory.length,synopsisPresent:hasSynopsis,synopsisSummaryChars:lesson.summary?.length||0,additionalNotesChars:lesson.notes?.length||0,examples:lesson.examples.length,practiceQuestions:attempt.test.questions.length,questionTemplates:[...types],draftReload:true,wrongAnswerExplanation:true,mistakeCorrected:true,completion:true,reloginPersisted:true,horizontalOverflow:false,browserErrors:errors});
});
