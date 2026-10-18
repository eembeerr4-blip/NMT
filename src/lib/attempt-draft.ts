export type DraftAnswers = Record<string, unknown>;
export type DraftSaveResult = {ok:true} | {ok:false;error:string};
export type DraftView = {answers:DraftAnswers;index:number;status:"saved"|"saving"|"pending"|"error";error:string};
type Storage = Pick<globalThis.Storage,"getItem"|"setItem"|"removeItem">;
type StoredDraft = {version:1;answers:DraftAnswers;index:number;pending:string[]};

/** Unacknowledged local fields override only their own server fields. */
export function recoverDraft(server:DraftAnswers, raw:string|null, allowed:readonly string[], initialIndex:number) {
  const answers = Object.fromEntries(Object.entries(server).filter(([id])=>allowed.includes(id)));
  const pending = new Set<string>();
  let index=initialIndex;
  try {
    const local:StoredDraft = JSON.parse(raw ?? "null");
    if(local?.version===1 && local.answers && typeof local.answers==="object" && !Array.isArray(local.answers) && Array.isArray(local.pending)) {
      for(const id of local.pending) if(allowed.includes(id) && Object.hasOwn(local.answers,id)) {
        answers[id]=local.answers[id];
        if(JSON.stringify(answers[id])!==JSON.stringify(server[id])) pending.add(id);
      }
      if(Number.isInteger(local.index))index=local.index;
    }
  } catch { /* A damaged local entry must not hide the server draft. */ }
  return {answers,pending,index:Math.max(0,Math.min(Math.max(0,allowed.length-1),index))};
}

export class AttemptDraft {
  private view:DraftView;
  private pending:Set<string>;
  private revision=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private flight:Promise<boolean>|null=null;
  private stopped=false;
  private disposed=false;
  private dirty=false;

  constructor(private readonly options:{key:string;storage:Storage;server:DraftAnswers;index:number;allowed:readonly string[];save:(answers:DraftAnswers,index:number)=>Promise<DraftSaveResult>;notify:(view:DraftView)=>void}) {
    let raw:string|null=null;
    let error="";
    try {raw=options.storage.getItem(options.key);} catch {error="Браузер не дозволяє зберегти локальну чернетку. Дочекайтеся збереження на сервері.";}
    const recovered=recoverDraft(options.server,raw,options.allowed,options.index);
    this.pending=recovered.pending;
    this.dirty=this.pending.size>0 || recovered.index!==options.index;
    this.view={answers:recovered.answers,index:recovered.index,status:error?"error":this.dirty?"pending":"saved",error};
  }
  snapshot(){return this.view;}
  start(){this.emit();if(this.dirty)this.schedule();}
  private emit(){if(!this.disposed)this.options.notify({...this.view,answers:{...this.view.answers}});}
  private persist(){
    try {this.options.storage.setItem(this.options.key,JSON.stringify({version:1,answers:this.view.answers,index:this.view.index,pending:[...this.pending]}));return true;}
    catch {this.view.status="error";this.view.error="Локальна чернетка не збережена. Не закривайте сторінку до збереження на сервері.";return false;}
  }
  change(id:string,value:unknown){
    if(this.stopped || !this.options.allowed.includes(id))return;
    this.pending.add(id);this.view.answers={...this.view.answers,[id]:value};this.changed();
  }
  navigate(index:number){if(this.stopped)return;this.view.index=Math.max(0,Math.min(this.options.allowed.length-1,index));this.changed();}
  private changed(){this.revision++;this.dirty=true;this.view.status="pending";this.view.error="";this.persist();this.emit();this.schedule();}
  private schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.flush();},450);}
  async flush():Promise<boolean>{
    clearTimeout(this.timer);
    if(this.stopped)return false;
    if(this.flight){const ok=await this.flight;return ok && this.dirty ? this.flush() : ok;}
    if(!this.dirty)return true;
    const revision=this.revision;
    const sent={...this.view.answers};const index=this.view.index;
    this.view.status="saving";this.emit();
    this.flight=(async()=>{
      try {
        const result=await this.options.save(sent,index);
        if(!result.ok)throw new Error(result.error);
        for(const id of this.pending)if(JSON.stringify(this.view.answers[id])===JSON.stringify(sent[id]))this.pending.delete(id);
        this.dirty=this.revision!==revision;
        this.view.status=this.dirty?"pending":"saved";this.view.error="";
        this.persist();
        // A confirmed server save is durable even if local storage is unavailable.
        if(!this.dirty){this.view.status="saved";this.view.error="";}
        return true;
      }catch(error){this.view.status="error";this.view.error=error instanceof Error?error.message:"Не вдалося зберегти відповіді.";return false;}
      finally{this.flight=null;this.emit();}
    })();
    return this.flight;
  }
  async pause(){clearTimeout(this.timer);this.stopped=true;if(this.flight)await this.flight;}
  resume(){this.stopped=false;this.emit();if(this.dirty)this.schedule();}
  complete(){this.stopped=true;clearTimeout(this.timer);try{this.options.storage.removeItem(this.options.key);}catch{/* The completed server attempt is authoritative. */}}
  dispose(){clearTimeout(this.timer);this.disposed=true;this.stopped=true;}
}
