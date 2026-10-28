'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnswerInput, type PublicQuestion } from './test-runner';
import { Button, Card } from './ui';
import { MathText } from './math-text';
import { submitMistakeRetry } from '@/server/mistake-retry-actions';
export function MistakeRetryForm({mistakeId,requestId:initialId,revision,question}:{mistakeId:string;requestId:string;revision:string;question:PublicQuestion}) {
  const [requestId,setRequestId]=useState(initialId),[answer,setAnswer]=useState<unknown>('');
  const [result,setResult]=useState<Awaited<ReturnType<typeof submitMistakeRetry>>|null>(null),[pending,setPending]=useState(false);
  const busy=useRef(false),router=useRouter();
  return <Card className="space-y-4 p-4 sm:p-6"><MathText text={question.prompt}/><form className="space-y-4" onSubmit={async event=>{
    event.preventDefault();if(busy.current)return;busy.current=true;setPending(true);
    try {const response=await submitMistakeRetry({mistakeId,requestId,revision,answer});setResult(response);if(response.ok)router.refresh();}
    catch {setResult({ok:false,error:'Зв’язок перервався. Повторіть відправлення: той самий запит не створить дубль.'});}
    finally {busy.current=false;setPending(false);}
  }}><fieldset disabled={pending||Boolean(result?.ok)} className="min-w-0"><legend className="sr-only">Нова відповідь</legend><AnswerInput sequenceSeed={requestId} question={question} value={answer} onChange={setAnswer}/></fieldset>
  <Button type="submit" disabled={pending||Boolean(result?.ok)}>{pending?'Перевірка…':'Перевірити нову відповідь'}</Button></form>
  {result?<div role="status" className="space-y-3" aria-live="polite">{result.ok?<><p>{result.isCorrect===true?'Правильно. Помилку виправлено.':result.isCorrect===false?'Неправильно. Поверніться до пояснення й спробуйте ще раз.':'Відповідь не підтверджено автоматично. Помилка залишається на повторенні; це не доведене виправлення.'}</p><h2 className="font-medium">Пояснення після спроби</h2><MathText text={result.explanation}/><Button type="button" variant="outline" onClick={()=>{setRequestId(crypto.randomUUID());setAnswer('');setResult(null);}}>Розв’язати ще раз</Button></>:<p>{result.error}</p>}</div>:null}
  <p className="text-sm text-muted-foreground">Це виправлення помилки, а не новий пробник. Старий результат тесту не змінюється. Для короткого тексту автоматично підтверджуються лише відомі нормативні варіанти.</p></Card>;
}
