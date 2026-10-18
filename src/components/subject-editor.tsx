"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {saveSubjectDetails} from "@/server/content-actions";
import {Button,Input,Textarea} from "./ui";
export function SubjectEditor({subject}:{subject:{id:string;name:string;shortName:string;description:string}}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 return <form className="max-w-xl space-y-4" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage("");try{const result=await saveSubjectDetails({id:subject.id,name:form.get("name"),shortName:form.get("shortName"),description:form.get("description")});setMessage(result.ok?"Предмет збережено.":result.error);if(result.ok)router.refresh();}catch{setMessage("Не вдалося зберегти зміни. Спробуйте ще раз.");}finally{setBusy(false);}}}><label className="grid gap-1.5 text-sm"><span className="font-medium">Назва предмета</span><Input name="name" defaultValue={subject.name} minLength={2} maxLength={120} required disabled={busy}/></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Коротка назва</span><Input name="shortName" defaultValue={subject.shortName} minLength={2} maxLength={60} required disabled={busy}/></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Опис</span><Textarea name="description" defaultValue={subject.description} maxLength={2000} disabled={busy}/></label><Button disabled={busy} type="submit">{busy?"Збереження…":"Зберегти предмет"}</Button>{message?<p role="status" className="text-sm">{message}</p>:null}</form>;
}
