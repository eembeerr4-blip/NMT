import {afterEach,expect,it,vi} from "vitest";
import {AttemptDraft,recoverDraft,type DraftSaveResult,type DraftView} from "./attempt-draft";
function fixture(save:(answers:Record<string,unknown>,index:number)=>Promise<DraftSaveResult>=async()=>({ok:true})){
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const views:DraftView[]=[];
  const options={key:"attempt:A:one",storage,server:{q1:"server",q2:"kept"},index:0,allowed:["q1","q2"],save,notify:(view:DraftView)=>views.push(view)};
  return {values,storage,views,options,draft:new AttemptDraft(options)};
}
afterEach(()=>vi.useRealTimers());
it("persists before debounce and merges unacknowledged edits after an immediate reload",()=>{
  vi.useFakeTimers();const f=fixture();f.draft.change("q1","local");f.draft.dispose();
  const restored=new AttemptDraft(f.options);expect(restored.snapshot().answers).toEqual({q1:"local",q2:"kept"});expect(restored.snapshot().status).toBe("pending");restored.dispose();
});
it("retains fresh server answers when an acknowledged local snapshot is stale",()=>{
  expect(recoverDraft({q1:"new-server"},JSON.stringify({version:1,answers:{q1:"old-local"},pending:[],index:0}),["q1"],0).answers.q1).toBe("new-server");
});
it("ignores corrupt local data, unknown question ids and invalid indexes",()=>{
  expect(recoverDraft({q1:"server"},"{bad",["q1"],0).answers).toEqual({q1:"server"});
  const r=recoverDraft({q1:"server"},JSON.stringify({version:1,answers:{other:"secret"},pending:["other"],index:900}),["q1"],0);expect(r.answers).toEqual({q1:"server"});expect(r.index).toBe(0);
});
it("never marks an offline or rejected save as saved and restores it for retry",async()=>{
  vi.useFakeTimers();let online=false;const f=fixture(async()=>online?{ok:true}:{ok:false,error:"Offline"});f.draft.change("q1","edit");expect(await f.draft.flush()).toBe(false);expect(f.draft.snapshot()).toMatchObject({status:"error",error:"Offline"});expect(f.values.has(f.options.key)).toBe(true);
  online=true;expect(await f.draft.flush()).toBe(true);expect(f.draft.snapshot().status).toBe("saved");expect(JSON.parse(f.values.get(f.options.key)!).pending).toEqual([]);f.draft.dispose();
});
it("serializes saves and does not let an older acknowledgement discard newer edits",async()=>{
  vi.useFakeTimers();let resolveFirst!:(v:DraftSaveResult)=>void;const sent:Record<string,unknown>[]=[];
  const f=fixture(async answers=>{sent.push({...answers});if(sent.length===1)return new Promise<DraftSaveResult>(resolve=>{resolveFirst=resolve;});return {ok:true};});
  f.draft.change("q1","first");const first=f.draft.flush();f.draft.change("q1","second");const second=f.draft.flush();resolveFirst({ok:true});await first;await second;
  expect(sent.map(row=>row.q1)).toEqual(["first","second"]);expect(f.draft.snapshot()).toMatchObject({answers:{q1:"second"},status:"saved"});f.draft.dispose();
});
it("keeps a failed completion draft while paused and clears it only after confirmed success",async()=>{
  vi.useFakeTimers();const f=fixture();f.draft.change("q1","recoverable");await f.draft.pause();expect(f.values.has(f.options.key)).toBe(true);f.draft.resume();expect(f.draft.snapshot().answers.q1).toBe("recoverable");f.draft.complete();expect(f.values.has(f.options.key)).toBe(false);
});
it("does not read another user's scoped draft",()=>{
  vi.useFakeTimers();const f=fixture();f.draft.change("q1","A only");const b=new AttemptDraft({...f.options,key:"attempt:B:one",server:{}});expect(b.snapshot().answers).toEqual({});f.draft.dispose();b.dispose();
});
it("surfaces unavailable local storage, then accepts a durable server save",async()=>{
  vi.useFakeTimers();const f=fixture();const storage={getItem:()=>{throw Error("blocked");},setItem:()=>{throw Error("quota");},removeItem:()=>{throw Error("blocked");}};
  const d=new AttemptDraft({...f.options,storage});d.change("q1","value");expect(d.snapshot().status).toBe("error");expect(await d.flush()).toBe(true);expect(d.snapshot().status).toBe("saved");d.complete();
});
