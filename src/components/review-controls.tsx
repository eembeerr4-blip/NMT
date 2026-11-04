"use client";

import {useRouter} from "next/navigation";
import {completeReview,reviewFlashcard,saveFlashcard} from "@/server/actions";
import {Button,Input} from "./ui";
import {useActionFeedback} from "./use-action-feedback";

export function ReviewControls({id,card=false,disabled=false}:{id:string;card?:boolean;disabled?:boolean}) {
  const {pending,result,run}=useActionFeedback();
  const router=useRouter();
  return <div className="space-y-2"><div className="flex gap-2">
    {card?<><Button size="sm" variant="outline" disabled={pending} onClick={()=>run(()=>reviewFlashcard(id,"again"),()=>router.refresh())}>Повторити</Button><Button size="sm" disabled={pending} onClick={()=>run(()=>reviewFlashcard(id,"good"),()=>router.refresh())}>Пам’ятаю</Button></>:<Button size="sm" disabled={pending||disabled} onClick={()=>run(()=>completeReview(id),()=>router.refresh())}>Позначити повтореним</Button>}
  </div>{!card?<p className="text-xs text-muted-foreground">Самостійна позначка повторення не підтверджує виправлення помилок. Для цього розв’яжіть завдання повторно.</p>:null}{result?<p role={result.ok?"status":"alert"} className="text-sm">{result.ok?result.message??"Повторення збережено.":result.error}</p>:null}</div>;
}

export function FlashcardForm({topics}:{topics:{id:string;subjectId:string;title:string}[]}) {
  const {pending,result,run}=useActionFeedback();
  const router=useRouter();
  return <form className="grid gap-2" onSubmit={async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    const topic=topics.find(item=>item.id===String(form.get("topicId")));
    await run(()=>saveFlashcard({topicId:topic?.id,subjectId:topic?.subjectId,kind:String(form.get("kind")??"term"),front:String(form.get("front")??""),back:String(form.get("back")??"")}),()=>router.refresh());
  }}>
    <label className="grid gap-1 text-sm">Тема<select name="topicId" className="h-10 rounded-lg border border-border bg-card px-2">{topics.map(topic=><option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Тип картки<select name="kind" className="h-10 rounded-lg border border-border bg-card px-2">{[["formula","Формула"],["date","Дата"],["person","Персоналія"],["term","Термін"],["rule","Правило"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Запитання<Input name="front" required/></label>
    <label className="grid gap-1 text-sm">Відповідь<Input name="back" required/></label>
    <Button className="justify-self-start" type="submit" disabled={pending}>{pending?"Збереження…":"Додати картку"}</Button>
    {result?<p role={result.ok?"status":"alert"} className="text-sm">{result.ok?"Картку додано.":result.error}</p>:null}
  </form>;
}
