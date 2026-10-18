const WINDOW_MS=15*60*1000;
const failures=new Map<string,{count:number;until:number;firstAt:number}>();
let calls=0;
function touch(){if(++calls%100===0){const now=Date.now();for(const [key,value] of failures){if(value.until<=now&&now-value.firstAt>WINDOW_MS)failures.delete(key);}}}
export function isLocked(key:string){touch();const entry=failures.get(key);return Boolean(entry&&entry.count>=5&&entry.until>Date.now());}
export function registerFail(key:string){touch();const now=Date.now();let entry=failures.get(key);if(!entry||(!isLocked(key)&&now-entry.firstAt>WINDOW_MS))entry={count:0,until:0,firstAt:now};entry.count++;if(entry.count===5)entry.until=now+WINDOW_MS;failures.set(key,entry);}
export function clearFails(key:string){touch();failures.delete(key);}
