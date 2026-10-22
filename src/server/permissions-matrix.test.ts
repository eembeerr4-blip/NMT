import {beforeEach,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),database:vi.fn(),secretRead:vi.fn(),secretWrite:vi.fn()}));
vi.mock("@/server/session",()=>({getSessionUser:mock.user,createSession:vi.fn(),clearSession:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:new Proxy({}, {get(){mock.database();throw Error("Unexpected database access before permission check");}})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/headers",()=>({headers:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn(),notFound:vi.fn()}));
import * as actions from "./actions";
import {saveSubjectDetails} from "./content-actions";

const contentActions:Record<string,()=>Promise<unknown>>={
 addVideo:()=>actions.addVideo("QA-topic","https://youtu.be/abcdefghijk","QA-video"),
 updateVideo:()=>actions.updateVideo("QA-video","https://youtu.be/abcdefghijk","QA-title"),
 deleteVideo:()=>actions.deleteVideo("QA-video"),makePrimary:()=>actions.makePrimary("QA-video"),
 setVideoReview:()=>actions.setVideoReview("QA-video","CONFIRMED"),setVideoRole:()=>actions.setVideoRole("QA-video","primary"),
 saveQuestion:()=>actions.saveQuestion({}),deleteQuestion:()=>actions.deleteQuestion("QA-question"),
 importQuestions:()=>actions.importQuestions("[]"),verifyQuestion:()=>actions.verifyQuestion("QA-question","VERIFIED"),
 updateTopic:()=>actions.updateTopic({id:"QA-topic",title:"QA-title",summary:"",formulas:"",status:"NOT_STARTED"}),
 createTopic:()=>actions.createTopic({subjectId:"math",title:"QA-title",summary:""}),
 saveLessonContent:()=>actions.saveLessonContent("QA-topic",{}),
 saveSubjectDetails:()=>saveSubjectDetails({id:"math",name:"QA-title",shortName:"QA",description:""}),
};
const administrativeActions:Record<string,()=>Promise<unknown>>={
 saveSchedule:()=>actions.saveSchedule("{}"),saveFormat:()=>actions.saveFormat("{}"),
 updateUserRole:()=>actions.updateUserRole("QA-target","EDITOR"),
};
const ownerActions:Record<string,()=>Promise<unknown>>={
 buildBackup:()=>actions.buildBackup(),
 restoreBackup:()=>actions.restoreBackup("{}","ВІДНОВИТИ"),
 moderateUserAccount:()=>actions.moderateUserAccount("QA-target","APPROVED"),
};
beforeEach(()=>vi.resetAllMocks());
for(const role of ["ANON","STUDENT","EDITOR","ADMIN"]){
 const cases=role==="ANON"||role==="STUDENT"?{...contentActions,...administrativeActions,...ownerActions}:role==="EDITOR"?{...administrativeActions,...ownerActions}:ownerActions;
 for(const [name,invoke] of Object.entries(cases))it(`permissions: ${role} cannot directly call ${name} or touch storage`,async()=>{
  mock.user.mockResolvedValue(role==="ANON"?null:{id:"QA-actor",role,firstName:"QA-actor",onboarded:true});
  let response:unknown;
  try{response=await invoke();}catch(error){expect((error as Error).message).toMatch(/вхід|редактор|адміністратор|власнику/i);}
  if(response!==undefined)expect(response).toMatchObject({ok:false,error:expect.any(String)});
  expect(mock.database).not.toHaveBeenCalled();
 });
}
