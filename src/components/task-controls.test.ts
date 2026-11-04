import {beforeEach,expect,it,vi} from "vitest";
import {isValidElement,type ReactNode} from "react";
const calls=vi.hoisted(()=>({setTaskStatus:vi.fn(),moveTask:vi.fn(),push:vi.fn(),refresh:vi.fn(),notify:vi.fn()}));
vi.mock("@/server/actions",()=>({setTaskStatus:calls.setTaskStatus,moveTask:calls.moveTask}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:calls.push,refresh:calls.refresh})}));
vi.mock("react",async()=>({...await vi.importActual<typeof import("react")>("react"),useState:(value:unknown)=>[value,calls.notify],useRef:(value:unknown)=>({current:value}),useCallback:(value:unknown)=>value}));
import {TaskControls} from "./task-controls";
function startHandler(){
 let found:(()=>Promise<unknown>)|undefined;
 function walk(node:ReactNode){if(Array.isArray(node)){node.forEach(walk);return;}if(!isValidElement<{children?:ReactNode;onClick?:()=>Promise<unknown>}>(node))return;if(node.props.children==="Розпочати")found=node.props.onClick;walk(node.props.children);}
 walk(TaskControls({task:{id:"QA-task",status:"PLANNED",topicId:"QA-topic",kind:"study"}}));
 if(!found)throw Error("Start button missing");return found;
}
beforeEach(()=>vi.resetAllMocks());
it("A07: a refused task start must show failure and never navigate",async()=>{
 calls.setTaskStatus.mockResolvedValue({ok:false,error:"QA-відмова"});
 await startHandler()();expect(calls.push).not.toHaveBeenCalled();expect(calls.refresh).not.toHaveBeenCalled();
 expect(calls.notify.mock.calls.flat().some(value=>typeof value==="object"&&value?.error==="QA-відмова")).toBe(true);
});
it("A07: transport failure is handled without a redirect or rejected event handler",async()=>{
 calls.setTaskStatus.mockRejectedValue(Error("network"));
 await expect(startHandler()()).resolves.toBeDefined();expect(calls.push).not.toHaveBeenCalled();
});
it("A07: overlapping clicks send one mutation; successful start navigates once",async()=>{
 let finish!:(value:{ok:true})=>void;calls.setTaskStatus.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const start=startHandler();const first=start();const second=start();finish({ok:true});await Promise.all([first,second]);
 expect(calls.setTaskStatus).toHaveBeenCalledTimes(1);expect(calls.push).toHaveBeenCalledTimes(1);
});
