import {beforeEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";

// Every data entry point is mocked: this suite never opens a database.
const mock=vi.hoisted(()=>({user:{id:"A"},topic:vi.fn(),siblings:vi.fn(),progress:vi.fn(),questions:vi.fn(),attempt:vi.fn(),review:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{topic:{findUnique:mock.topic,findMany:mock.siblings},userTopicProgress:{findUnique:mock.progress},question:{count:mock.questions},testAttempt:{findFirst:mock.attempt},reviewSchedule:{findFirst:mock.review}}}));
vi.mock("@/server/session",()=>({requireUser:async()=>mock.user}));
vi.mock("@/server/actions",()=>({}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("NOT_FOUND")}}));
import LessonPage from "@/app/(main)/learn/[topicId]/page";

const lessonJson=JSON.stringify({objectives:["Розпізнавати рівняння"],theory:"Незмінений матеріал: $ax+b=0$",examples:[{task:"$x+2=3$",solution:"Віднімаємо 2. $x=1$."}],summary:"Короткий конспект",rules:[],mistakes:[]});
const topic=(id="current",sortOrder=2,available=true)=>({id,title:`Тема ${id}`,subjectId:"math",subject:{name:"Математика"},parentId:null,sortOrder,lessonJson:available?lessonJson:"",children:[],questions:[],videos:[],summary:"Опис теми",formulas:"$a\\ne0$",estimatedMin:20});
const render=async()=>renderToStaticMarkup(await LessonPage({params:Promise.resolve({topicId:"current"})}));
beforeEach(()=>{vi.clearAllMocks();mock.user.id="A";mock.topic.mockResolvedValue(topic());mock.siblings.mockResolvedValue([topic("previous",0),topic("missing",1,false),topic(),topic("unavailable-next",3,false),topic("next",4)]);mock.progress.mockResolvedValue(null);mock.questions.mockResolvedValue(0);mock.attempt.mockResolvedValue(null);mock.review.mockResolvedValue(null)});

it("uses real available sibling IDs, skips unavailable lessons and never invents numbered URLs",async()=>{const html=await render();expect(html).toContain('href="/learn/previous"');expect(html).toContain('href="/learn/next"');expect(html).not.toContain('/learn/missing');expect(html).not.toContain('/learn/unavailable-next');expect(mock.siblings).toHaveBeenCalledWith(expect.objectContaining({where:{subjectId:"math",parentId:null},orderBy:{sortOrder:"asc"}}))});
it("keeps video, attempt, review and progress queries scoped to each authenticated user",async()=>{
 for(const userId of ["A","B"]){
  mock.user.id=userId;await render();
  expect(mock.topic).toHaveBeenLastCalledWith(expect.objectContaining({include:expect.objectContaining({videos:expect.objectContaining({include:{progress:{where:{userId}}}})})}));
  expect(mock.progress).toHaveBeenLastCalledWith({where:{userId_topicId:{userId,topicId:"current"}}});
  expect(mock.attempt).toHaveBeenLastCalledWith(expect.objectContaining({where:{userId,status:"COMPLETED",test:{topicId:"current"}}}));
  expect(mock.review).toHaveBeenLastCalledWith(expect.objectContaining({where:{userId,topicId:"current",status:"PENDING"}}));
 }
});
it("does not turn theory-only material into a fake progress percentage or active test",async()=>{const html=await render();expect(html).toContain('disabled=""');expect(html).toContain('Позначити конспект як опрацьований');expect(html).toContain('Перевірених завдань для цієї теми ще немає');expect(html).toContain('Не розпочато');expect(html).not.toContain('role="progressbar"');expect(html).not.toContain('40%');expect(html).not.toContain('Засвоєно')});
it("shows actual mastery and completed result without treating a pending review as completed",async()=>{mock.progress.mockResolvedValue({status:"MASTERED"});mock.questions.mockResolvedValue(12);mock.attempt.mockResolvedValue({id:"own-result",finishedAt:new Date("2026-10-19T10:00:00Z"),totalCount:12,correctCount:8,pendingCount:2});const html=await render();expect(html).toContain('Засвоєно');expect(html).toContain('8 із 12');expect(html).toContain('на перевірці 2');expect(html).toContain('/tests/own-result');expect(html).toContain('Завершити урок')});
it("keeps IN_PROGRESS honest and uses disabled navigation at both ends",async()=>{mock.progress.mockResolvedValue({status:"IN_PROGRESS"});mock.siblings.mockResolvedValue([topic()]);const html=await render();expect(html).toContain('Вивчається');expect(html).toContain('Це перша доступна тема');expect(html).toContain('Наступного доступного матеріалу ще немає');expect(html).not.toContain('/learn/undefined')});
it("offers a genuine preparation state without mounting a lesson or practice for unavailable material",async()=>{mock.topic.mockResolvedValue(topic("current",2,false));const html=await render();expect(html).toContain('Матеріал готується');expect(html).not.toContain('role="tab"');expect(html).not.toContain('Пройти тест');expect(mock.attempt).not.toHaveBeenCalled()});
it("preserves verified practice-only access with the practice tab selected",async()=>{mock.topic.mockResolvedValue({...topic(),lessonJson:"",questions:[{difficulty:"EASY"}]});mock.questions.mockResolvedValue(1);const html=await render();expect(html).toMatch(/data-state="active"[^>]*[^<]*>Практика/);expect(html).toContain('1 перевірених запитань');expect(html).toContain('Теорію ще готують')});
it("handles a video-only lesson and never renders editor controls to a learner",async()=>{mock.topic.mockResolvedValue({...topic(),lessonJson:"",summary:"",formulas:"",videos:[{id:"video",youtubeId:"existing",url:"https://www.youtube.com/watch?v=existing",title:"Реальне пояснення",reviewStatus:"CONFIRMED",isPrimary:true,durationSec:null,progress:[{notes:"Моя відеонотатка",lastPositionSec:120}]}]});const html=await render();expect(html).toContain('Реальне пояснення');expect(html).toContain('Зупинились на 2 хв');expect(html).toContain('Моя відеонотатка');expect(html).not.toContain('Інструменти редактора відео');expect(html).toContain('Навчальний конспект ще готується');expect(html).not.toContain('Повний матеріал доступний')});
it("keeps a section's existing child links",async()=>{mock.topic.mockResolvedValue({...topic("current",2,false),children:[{id:"child-real",title:"Вкладений урок"}]});expect(await render()).toContain('/learn/child-real')});
it("keeps missing IDs as notFound, rather than redirecting to the home screen",async()=>{mock.topic.mockResolvedValue(null);await expect(render()).rejects.toThrow('NOT_FOUND')});
