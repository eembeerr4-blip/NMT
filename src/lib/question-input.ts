import { randomUUID } from "crypto";
import { questionSchema } from "./validators";
import { UserError } from "./errors";
export function prepareQuestion(raw: unknown, { preserveIds = false } = {}) {
 const q=questionSchema.parse(raw);
 const options=q.options.map((o,index)=>({...o,id:preserveIds && o.id ? o.id : randomUUID(),sortOrder:index}));
 const refs=new Map<string,string>();q.options.forEach((o,i)=>{if(refs.has(o.label))throw new UserError("Мітки варіантів мають бути унікальними.");refs.set(o.label,options[i].id);if(o.id)refs.set(o.id,options[i].id)});
 const ref=(v:unknown)=>{const id=refs.get(String(v));if(!id)throw new UserError("Правильна відповідь посилається на невідомий варіант.");return id};
 let answer=q.correctAnswer;
 if(q.type==='NUMERIC'&&!/^-?\d+([.,]\d+)?$/.test(answer.trim()))throw new UserError("Введіть числову відповідь.");
 if(q.type==='SINGLE_CHOICE'){if(options.length<2)throw new UserError("Потрібно щонайменше два варіанти.");answer=ref(answer)}
 if(q.type==='SEQUENCE'){const a=JSON.parse(answer) as unknown;if(!Array.isArray(a)||a.length!==options.length||new Set(a).size!==options.length||a.length<2)throw new UserError("Послідовність має містити кожен варіант рівно один раз.");answer=JSON.stringify(a.map(ref))}
 if(q.type==='MATCHING'){const a=JSON.parse(answer) as Record<string,string>;if(!a||Array.isArray(a)||typeof a!=='object')throw new UserError("Відповідність має бути JSON-об’єктом.");const left=q.options.filter(o=>o.matchKey==='left');const right=q.options.filter(o=>o.matchKey==='right');if(!left.length||!right.length||Object.keys(a).length!==left.length)throw new UserError("Вкажіть усі ліві й праві варіанти.");const mapped:Record<string,string>={};for(const [l,r] of Object.entries(a)){if(!left.some(o=>o.label===l||o.id===l)||!right.some(o=>o.label===r||o.id===r))throw new UserError("Пари мають поєднувати лівий та правий варіанти.");mapped[ref(l)]=ref(r)}answer=JSON.stringify(mapped)}
 return {...q,correctAnswer:answer,options};
}
