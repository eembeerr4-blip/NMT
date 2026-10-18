import vm from "node:vm";
import katex from "katex";
import {pathToFileURL} from "node:url";
import {gradeAnswer} from "../src/lib/grade";
import {prepareQuestion} from "../src/lib/question-input";
import {loadMathContent,type MathContent,type MathContentQuestion} from "../src/lib/math-content";

const factorial=(n:number)=>{let result=1;for(let k=2;k<=n;k++)result*=k;return result;};
const choose=(n:number,k:number)=>{let result=1;for(let i=1;i<=k;i++)result=result*(n-k+i)/i;return result;};
const helpers={PI:Math.PI,Number,sqrt:Math.sqrt,log:Math.log,abs:Math.abs,min:Math.min,max:Math.max,sin:(d:number)=>Math.sin(d*Math.PI/180),cos:(d:number)=>Math.cos(d*Math.PI/180),tan:(d:number)=>Math.tan(d*Math.PI/180),factorial,choose,integers:(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i),solveX:(a:number,b:number,e:number,c:number,d:number,f:number)=>(e*d-b*f)/(a*d-b*c),solveY:(a:number,b:number,e:number,c:number,d:number,f:number)=>(a*f-e*c)/(a*d-b*c),qRoots:(a:number,b:number,c:number)=>{const disc=b*b-4*a*c;return disc<0?[]:disc===0?[-b/(2*a)]:[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)];},polyDerivative:(c:number[],x:number)=>c.reduce((s,a,i)=>s+(i?i*a*x**(i-1):0),0),polyIntegral:(c:number[],a:number,b:number)=>c.reduce((s,v,i)=>s+v/(i+1)*(b**(i+1)-a**(i+1)),0)};
// Executes only version-controlled, authored mathematical proof expressions, not uploaded content.
export function evaluateMath(expression:string):number{const value=new vm.Script("("+expression+")").runInNewContext({...helpers},{timeout:100});if(typeof value!=="number"||!Number.isFinite(value))throw new Error("Non-finite mathematical result: "+expression);return value;}
function close(actual:number,expected:number,label:string){if(Math.abs(actual-expected)>1e-8*Math.max(1,Math.abs(expected)))throw new Error(label+": calculated "+actual+", authored "+expected);}
export function verifyMathQuestion(q:MathContentQuestion){
 const prepared=prepareQuestion(q);
 if(q.type==="MATCHING"){
  if(q.verification.kind!=="matching")throw new Error("Missing matching proof: "+q.id);
  const answers=JSON.parse(q.correctAnswer) as Record<string,string>;
  const leftLabels=q.options.filter(o=>o.matchKey==="left").map(o=>o.label).sort();if(JSON.stringify(Object.keys(q.verification.expressions).sort())!==JSON.stringify(leftLabels)||JSON.stringify(Object.keys(answers).sort())!==JSON.stringify(leftLabels))throw new Error("Every matching pair needs an independent proof: "+q.id);
  if(new Set(Object.values(answers)).size!==3)throw new Error("Matching answers must be distinct: "+q.id);
  if(q.options.filter(o=>o.matchKey==="left").length!==3||q.options.filter(o=>o.matchKey==="right").length!==5)throw new Error("Expected 3 by 5 matching: "+q.id);
  for(const [left,expression]of Object.entries(q.verification.expressions)){const option=q.options.find(o=>o.label===answers[left]&&o.matchKey==="right");if(option?.numericValue===undefined)throw new Error("Unknown matching reference: "+q.id);close(evaluateMath(expression),option.numericValue,q.id+" pair "+left);}
  const expected=JSON.parse(prepared.correctAnswer);if(!gradeAnswer({type:q.type,correctAnswer:prepared.correctAnswer,userAnswer:expected}).isCorrect)throw new Error("Matching grader rejected key: "+q.id);
 }else{
  if(q.verification.kind!=="numeric")throw new Error("Missing numeric proof: "+q.id);
  const computed=evaluateMath(q.verification.expression);
  const expected=q.type==="SINGLE_CHOICE"?q.options.find(o=>o.label===q.correctAnswer)?.numericValue:Number(q.correctAnswer);
  if(expected===undefined||!Number.isFinite(expected))throw new Error("Invalid answer: "+q.id);
  close(computed,expected,q.id);
  if(q.type==="SINGLE_CHOICE"){
   if(q.options.length!==5||new Set(q.options.map(o=>o.numericValue)).size!==5||q.options.some(o=>!o.rationale))throw new Error("Invalid distractors: "+q.id);
   for(const option of q.options){const preparedOption=prepared.options.find(o=>o.label===option.label)!;if(gradeAnswer({type:q.type,correctAnswer:prepared.correctAnswer,userAnswer:preparedOption.id}).isCorrect!==(option.label===q.correctAnswer))throw new Error("Choice grader mismatch: "+q.id);}
  }else{if(q.options.length||q.type!=="NUMERIC")throw new Error("Unsupported authored type: "+q.id);if(!gradeAnswer({type:q.type,correctAnswer:q.correctAnswer,userAnswer:String(computed)}).isCorrect)throw new Error("Numeric grader mismatch: "+q.id);}
 }
}
export function verifyMathContent(content:MathContent){
 let formulas=0,calculations=0;const ids=new Set<string>();
 for(const pack of content.packs){
  if(content.protectedTopicIds.includes(pack.topicId))throw new Error("Protected lesson included: "+pack.topicId);
  const counts={EASY:0,MEDIUM:0,HARD:0};for(const q of pack.questions){if(ids.has(q.id)||q.topicId!==pack.topicId||q.subjectId!=="math"||q.verificationStatus!=="DRAFT")throw new Error("Question identity/status: "+q.id);ids.add(q.id);counts[q.difficulty]++;verifyMathQuestion(q);calculations+=q.verification.kind==="matching"?Object.keys(q.verification.expressions).length:1;}
  if(counts.EASY<4||counts.MEDIUM<5||counts.HARD<3)throw new Error("Unbalanced practice: "+pack.topicId);
  if(pack.exampleChecks.length!==pack.lesson.examples.length)throw new Error("Every example needs a calculation: "+pack.topicId);
  for(const proof of pack.exampleChecks){close(evaluateMath(proof.expression),proof.expected,pack.topicId+" example");calculations++;}
  const strings:string[]=[];function collect(value:unknown){if(typeof value==="string")strings.push(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==="object")Object.values(value).forEach(collect);}collect({lesson:pack.lesson,questions:pack.questions.map(({prompt,explanation,options})=>({prompt,explanation,options})),cards:pack.flashcardTemplates});
  for(const text of strings){if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw new Error("Unexpected control character in "+pack.topicId);const parts=text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);for(const part of parts){if(part.startsWith("$$")&&part.endsWith("$$")){katex.renderToString(part.slice(2,-2),{throwOnError:true,displayMode:true,strict:"error"});formulas++;}else if(part.startsWith("$")&&part.endsWith("$")){katex.renderToString(part.slice(1,-1),{throwOnError:true,strict:"error"});formulas++;}else if(part.includes("$"))throw new Error("Unbalanced math delimiter in "+pack.topicId);}}
 }
 return {topics:content.packs.length,questions:ids.size,calculations,renderedFormulas:formulas,flashcardTemplates:content.packs.reduce((n,p)=>n+p.flashcardTemplates.length,0),status:"DRAFT",result:"PASS"};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(verifyMathContent(loadMathContent()),null,2));
