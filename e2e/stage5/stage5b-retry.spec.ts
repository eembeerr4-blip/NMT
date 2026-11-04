import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { existsSync } from 'node:fs';
const database=path.resolve('prisma/stage5b-qa.db');
if(!existsSync(database)||process.env.DATABASE_URL?.replaceAll('\\','/').split('?')[0]!=='file:'+database.replaceAll('\\','/'))throw new Error('Run only in the dedicated Stage 5B worktree with its synthetic QA database.');
const db=new PrismaClient({datasourceUrl:'file:'+database.replaceAll('\\','/')+'?connection_limit=1'});
async function login(page:Page,nickname='stage5-smoke',password='stage5-smoke-pass') {
 await page.goto('/login');await page.getByPlaceholder('Нікнейм').fill(nickname);await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:'Увійти',exact:true}).click();await expect(page).not.toHaveURL(/\/login/);
}
test.afterAll(()=>db.$disconnect());
async function expectDenied(page:Page,url:string){
 const before=await db.mistakeRetry.count();await page.goto(url);
 // Next.js streamed notFound responses may have status 200; assert denial and non-disclosure.
 await expect(page.getByRole('heading',{name:'Сторінку не знайдено',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Перевірити нову відповідь'})).toHaveCount(0);
 expect(await page.content()).not.toContain('HIDDEN_DRAFT_QA');expect(await db.mistakeRetry.count()).toBe(before);
}
test('wrong answer, transport replay, correct retry and history survive reload without test records',async({page})=>{
 await login(page);await page.goto('/mistakes');await page.locator('a[href="/mistakes/sm-open/retry"]').click();
 await expect(page).toHaveURL(/\/mistakes\/sm-open\/retry/);await expect(page.getByRole('heading',{name:'Повторне розв’язання',exact:true})).toBeVisible();
 const initial=await (await page.request.get('/mistakes/sm-open/retry')).text();expect(initial).not.toContain('correctAnswer');expect(initial).not.toContain('Пояснення з формулою');
 const before=await db.mistakeRetry.count({where:{mistakeId:'sm-open'}});const attempts=await db.testAttempt.count(),answers=await db.answer.count(),exams=await db.examResult.count();const historical=await db.mistake.findUniqueOrThrow({where:{id:'sm-open'}});
 await page.getByRole('textbox',{name:'Числова відповідь'}).fill('0');
 const capture=page.waitForRequest(r=>r.method()==='POST'&&Boolean(r.headers()['next-action']));await page.getByRole('button',{name:'Перевірити нову відповідь'}).click();const request=await capture;
 await expect(page.getByRole('status')).toContainText('Неправильно.');expect(await db.mistakeRetry.count({where:{mistakeId:'sm-open'}})).toBe(before+1);
 const headers=request.headers();const replay=await page.request.post(request.url(),{headers:{'next-action':headers['next-action'],'content-type':headers['content-type'],origin:'http://127.0.0.1:3113'},data:request.postData()!});expect(replay.status()).toBe(200);expect(await replay.text()).toContain('"ok":true');expect(await db.mistakeRetry.count({where:{mistakeId:'sm-open'}})).toBe(before+1);
 await page.getByRole('button',{name:'Розв’язати ще раз'}).click();await page.getByRole('textbox',{name:'Числова відповідь'}).fill('1');await page.getByRole('button',{name:'Перевірити нову відповідь'}).click();await expect(page.getByRole('status')).toContainText('Правильно. Помилку виправлено.');
 await page.reload();await expect(page.getByRole('heading',{name:'Історія повторних розв’язань'})).toBeVisible();expect(await db.mistakeRetry.count({where:{mistakeId:'sm-open'}})).toBe(before+2);const changed=await db.mistake.findUniqueOrThrow({where:{id:'sm-open'}});expect(changed.status).toBe('FIXED');expect(changed.userAnswer).toBe(historical.userAnswer);expect(changed.prompt).toBe(historical.prompt);
 expect(await db.testAttempt.count()).toBe(attempts);expect(await db.answer.count()).toBe(answers);expect(await db.examResult.count()).toBe(exams);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)).toBe(false);}
});
test('draft and foreign retries are denied and Stage 5A navigation remains usable',async({page})=>{
 await login(page);await expectDenied(page,'/mistakes/sm-draft/retry');await expectDenied(page,'/mistakes/sm-other/retry');await page.goto('/review');await expect(page.getByRole('heading',{name:'Повторення',exact:true})).toBeVisible();await page.goto('/mistakes');await expect(page.getByRole('heading',{name:'Мої помилки',exact:true})).toBeVisible();await login(page,'stage5-other','stage5-other-pass');await expectDenied(page,'/mistakes/sm-open/retry');
});
