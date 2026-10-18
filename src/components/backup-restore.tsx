"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Download, FileJson, Upload } from "lucide-react";
import { restoreBackup } from "@/server/actions";
import { Button, Input } from "@/components/ui";

export function BackupRestoreForm() {
  const id=useId();
  const router=useRouter();
  const [file,setFile]=useState<File|null>(null);
  const [confirmation,setConfirmation]=useState("");
  const [message,setMessage]=useState("");
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState(false);
  async function restore(){
    if(!file||confirmation!=="ВІДНОВИТИ"||pending)return;
    setPending(true);setMessage("");
    try {const result=await restoreBackup(await file.text(),confirmation);setMessage(result.ok?result.message??"Дані відновлено.":result.error);if(result.ok){setOpen(false);router.replace("/login");router.refresh();}}
    catch{setMessage("Не вдалося відновити дані. Перевірте файл і з’єднання та спробуйте ще раз.");}
    finally{setPending(false);}
  }
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <section className="space-y-4" aria-labelledby={`${id}-download`}><div className="flex items-center gap-3"><span className="rounded-xl bg-accent p-2.5 text-primary"><Download className="h-5 w-5"/></span><h3 id={`${id}-download`} className="font-semibold">Завантаження резервної копії</h3></div><p className="max-w-prose text-sm leading-6 text-muted-foreground">Збережіть файл із навчальними даними, профілями та журналом дій на своєму комп’ютері. Ключі інтеграцій до нього не входять.</p><Button asChild variant="secondary"><a href="/api/export/backup"><Download className="h-4 w-4"/>Завантажити копію</a></Button><p className="text-xs leading-5 text-muted-foreground">Формат файлу — JSON. Копія містить дані профілів: зберігайте її в надійному місці.</p></section>
    <section className="space-y-4 border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" aria-labelledby={`${id}-restore`}><div className="flex items-center gap-3"><span className="rounded-xl bg-danger-surface p-2.5 text-danger-text"><Upload className="h-5 w-5"/></span><h3 id={`${id}-restore`} className="font-semibold">Відновлення даних</h3></div><div className="flex gap-2.5 rounded-xl border border-danger-border bg-danger-surface p-3 text-sm leading-6 text-danger-text"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><p>Дані з файлу замінять поточні навчальні дані та профілі. Спочатку завантажте копію поточного стану. Після відновлення потрібно буде увійти знову.</p></div>
      <form className="max-w-lg space-y-4" onSubmit={event=>{event.preventDefault();setMessage("");if(file&&confirmation==="ВІДНОВИТИ")setOpen(true);}}>
        <div className="space-y-1.5"><p id={`${id}-file-label`} className="text-sm font-medium">Файл резервної копії</p><label className={`relative flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-background px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${pending?"pointer-events-none opacity-50":"hover:border-primary"}`}><input type="file" accept=".json,application/json" disabled={pending} aria-labelledby={`${id}-file-label`} className="sr-only" onChange={event=>{const next=event.target.files?.[0]??null;setMessage("");if(next&&(!next.name.toLowerCase().endsWith(".json")||next.size>50*1024*1024)){setFile(null);event.target.value="";setMessage("Оберіть файл .json розміром до 50 МБ.");return;}setFile(next);}}/><FileJson className="h-5 w-5 shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 break-all text-sm">{file?file.name:"Файл не обрано"}</span><span className="text-sm font-semibold text-primary">Обрати файл</span></label><p className="text-xs text-muted-foreground">Файл .json, до 50 МБ</p></div>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Підтвердження заміни даних</span><Input value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder="Введіть ВІДНОВИТИ" autoComplete="off" disabled={pending} aria-describedby={`${id}-hint`}/></label><p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">Кнопка стане доступною після вибору файлу та введення слова ВІДНОВИТИ великими літерами.</p><Button type="submit" variant="destructive" disabled={!file||confirmation!=="ВІДНОВИТИ"||pending}><Upload className="h-4 w-4"/>{pending?"Відновлення…":"Відновити з копії"}</Button>
      </form>{message?<p role="alert" className="text-sm leading-6 text-danger-text">{message}</p>:null}
    </section>
    <Dialog.Root open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"><Dialog.Title className="text-lg font-semibold">Замінити поточні дані?</Dialog.Title><Dialog.Description className="break-words text-sm leading-6 text-muted-foreground">Буде відновлено дані з файлу «{file?.name}». Поточні навчальні дані та профілі буде замінено. Переконайтеся, що ви вже зберегли їхню резервну копію.</Dialog.Description><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={pending} onClick={()=>setOpen(false)}>Скасувати</Button><Button variant="destructive" disabled={pending} onClick={()=>void restore()}>{pending?"Відновлення…":"Так, замінити дані"}</Button></div>{message?<p role="alert" className="text-sm text-danger-text">{message}</p>:null}</Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
