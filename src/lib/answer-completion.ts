type Question = {type:string; options:{id:string;matchKey:string|null}[]};
export function answerCompletion(question:Question,value:unknown):"empty"|"partial"|"complete" {
 const nonblank=(item:unknown)=>typeof item==="string"?item.trim().length>0:typeof item==="number"&&Number.isFinite(item);
 if(question.type==="SEQUENCE") {
  if(!Array.isArray(value)||value.length===0)return "empty";
  return value.length===question.options.length&&new Set(value).size===value.length&&value.every(id=>question.options.some(option=>option.id===id))?"complete":"partial";
 }
 if(question.type==="MATCHING") {
  if(!value||typeof value!=="object"||Array.isArray(value))return "empty";
  const map=value as Record<string,unknown>;
  const left=question.options.filter(option=>option.matchKey==="left");
  const count=left.filter(option=>question.options.some(right=>right.matchKey==="right"&&right.id===map[option.id])).length;
  return count===0?"empty":count===left.length?"complete":"partial";
 }
 if(question.type==="STEP_BY_STEP") {
  if(!value||typeof value!=="object")return "empty";
  const answer=value as {final?:unknown;work?:unknown};
  return nonblank(answer.final)?"complete":nonblank(answer.work)?"partial":"empty";
 }
 return nonblank(value)?"complete":"empty";
}
