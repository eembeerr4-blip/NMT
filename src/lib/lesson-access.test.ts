import {expect,it} from "vitest";
import {lessonAccess} from "./readiness";
it("empty material and unconfirmed video cannot enable learning",()=>{
 expect(lessonAccess({lessonJson:"{}",questions:[],videos:[{reviewStatus:"PENDING"}]})).toMatchObject({available:false,label:"Матеріал готується"});
});
it("short genuine theory can be studied without pretending the editorial checklist is complete",()=>{
 const lessonJson=JSON.stringify({objectives:[],theory:"QA-конспект",rules:[],examples:[],mistakes:[],summary:""});
 expect(lessonAccess({lessonJson})).toMatchObject({available:true,theory:true,label:"Конспект доступний"});
});
it("verified practice and confirmed video have independent honest availability",()=>{
 expect(lessonAccess({lessonJson:"{}",questions:[{}]})).toMatchObject({practice:true,available:true});
 expect(lessonAccess({lessonJson:"{}",videos:[{reviewStatus:"CONFIRMED"}]})).toMatchObject({video:true,available:true});
});
