import { beforeEach, expect, it, vi } from "vitest";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
const m=vi.hoisted(()=>({ user:{id:"A",subjects:[{subjectId:"math",active:true},{subjectId:"history",active:false}]}, one:vi.fn(), many:vi.fn(), sets:vi.fn(), progress:vi.fn() }));
vi.mock("@/lib/prisma",()=>({prisma:{testAttempt:{findUnique:m.one,findMany:m.many},test:{findMany:m.sets},userTopicProgress:{findUnique:m.progress}}}));
vi.mock("@/server/session",()=>({requireUser:async()=>m.user}));
vi.mock("@/server/sync",()=>({getSettings:async()=>({timerEnabled:true})}));
vi.mock("@/server/actions",()=>({gradeManually:vi.fn(),startTopicTest:vi.fn(),reportQuestion:vi.fn()}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("NOT_FOUND")},useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/components/test-runner",()=>({TestRunner:()=>jsx("div",{children:"runner"})}));
vi.mock("@/components/test-set-controls",()=>({StartTestSet:({id}:{id:string})=>jsx("button",{"data-set":id,children:"Розпочати тест"})}));
vi.mock("@/components/question-feedback",()=>({QuestionFeedback:()=>null}));
import TestsPage from "@/app/(main)/tests/page";
import AttemptPage from "@/app/(main)/tests/[id]/page";
const test={id:"set-id",title:"Published real set",kind:"EXAM",subjectId:"math",subject:{id:"math",name:"Математика"},topicId:null,topic:null,timeLimitSec:600,configJson:'{"publication":"PUBLISHED"}',questions:[{question:{id:"q1",verificationStatus:"VERIFIED",topic:{coverage:"READY",lessonJson:""},prompt:"Question 1",explanation:"",source:"",options:[]}},{question:{id:"q2",verificationStatus:"VERIFIED",topic:{coverage:"READY",lessonJson:""},prompt:"Question 2",explanation:"",source:"",options:[]}}]};
const a=(overrides={})=>({id:"attempt-id",userId:"A",status:"COMPLETED",draftJson:"{}",currentIndex:0,startedAt:new Date(0),finishedAt:new Date(30000),durationSec:30,percent:0,correctCount:0,totalCount:2,pendingCount:0,answers:[],test,...overrides});
const render=async()=>renderToStaticMarkup(await AttemptPage({params:Promise.resolve({id:"attempt-id"})}));
beforeEach(()=>{vi.clearAllMocks();m.one.mockResolvedValue(a());m.many.mockResolvedValue([]);m.sets.mockResolvedValue([]);m.progress.mockResolvedValue(null)});
it("lists only the current user's attempts and published sets of active subjects; keeps Test and TestAttempt URLs distinct",async()=>{
 m.many.mockResolvedValue([a({status:"IN_PROGRESS"}),a({id:"completed-id"})]);m.sets.mockResolvedValue([{...test,_count:{questions:2}}]);
 const html=renderToStaticMarkup(await TestsPage());expect(m.many).toHaveBeenCalledWith(expect.objectContaining({where:{userId:"A"},take:30}));expect(m.sets).toHaveBeenCalledWith(expect.objectContaining({where:{subjectId:{in:["math"]},configJson:{contains:'"publication":"PUBLISHED"'}},take:100}));expect(html).toContain('href="/tests/attempt-id"');expect(html).toContain('href="/tests/completed-id"');expect(html).toContain('data-set="set-id"');expect(html).not.toContain('href="/tests/set-id"');
});
it("shows honest empty states in all three catalogue groups",async()=>{const html=renderToStaticMarkup(await TestsPage());expect(html).toContain("Немає незавершених спроб");expect(html).toContain("Опублікованих наборів поки немає");expect(html).toContain("Завершених спроб ще немає")});
it("preserves a zero score and stored sub-minute duration without inventing an NMT rating",async()=>{const html=await render();expect(html).toContain("0%");expect(html).toContain("0/2");expect(html).toContain("0:30");expect(html).toContain("Це не рейтинговий бал НМТ");expect(html).not.toContain("До уроку")});
it("labels a pending score as provisional and keeps manual answer work visible",async()=>{
 m.one.mockResolvedValue(a({pendingCount:1,answers:[{id:"answer-a",questionId:"q",needsManualReview:true,userAnswer:JSON.stringify({work:"OWN PRIVATE STEPS",final:"OWN FINAL"})}],test:{...test,questions:[{question:{id:"q",verificationStatus:"VERIFIED",topic:{coverage:"READY",lessonJson:""},prompt:"Question",explanation:"",source:"",options:[]}}]}}));const html=await render();expect(html).toContain("попередній результат");expect(html).toContain("Очікує перевірки");expect(html).toContain("OWN PRIVATE STEPS");expect(html).toContain("OWN FINAL");expect(html).toContain("Пояснення до цього завдання ще не додано");expect(html).toContain("Зарахувати");
});
it("does not turn missing metrics into a fabricated zero or NaN",async()=>{m.one.mockResolvedValue(a({percent:null,correctCount:null,totalCount:null,durationSec:null}));const html=await render();expect(html).toContain("Відсоток не визначено");expect(html).toContain("Не записано");expect(html).not.toContain("NaN");expect(html).not.toContain('>0%</')});
it("guards direct foreign and missing attempt URLs before rendering results",async()=>{m.one.mockResolvedValue(a({userId:"B"}));await expect(render()).rejects.toThrow("NOT_FOUND");expect(m.one).toHaveBeenCalledWith(expect.objectContaining({where:{id:"attempt-id",userId:"A"}}));m.one.mockResolvedValue(null);await expect(render()).rejects.toThrow("NOT_FOUND")});
