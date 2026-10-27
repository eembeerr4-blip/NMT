"use client";
import { useState } from "react";
import { SUBJECTS } from "@/lib/constants";
import { externalSubjects, safeZnoUrl, topicCoverageLabel } from "@/lib/external-practice";
import mappings from "@/lib/zno-topic-map.json";
import { Input } from "@/components/ui";
export function ExternalTopicCatalog() {
  const [subject,setSubject]=useState("ukrainian"),[search,setSearch]=useState("");
  const rows=mappings.topics.filter(t=>t.subjectId===subject && t.title.toLocaleLowerCase("uk-UA").includes(search.toLocaleLowerCase("uk-UA")));
  return <section id="topics" className="space-y-3"><h2 className="text-lg font-semibold">Практика за темами · 288 тем</h2><p className="text-sm text-muted-foreground">Під кожним посиланням зазначено: точна тема, частина теми, ширша добірка, перетин або непідтверджене покриття.</p><label className="block text-sm">Предмет<select className="mt-1 block w-full rounded-xl border border-border bg-card p-3" value={subject} onChange={e=>setSubject(e.target.value)}>{externalSubjects.map(id=><option key={id} value={id}>{SUBJECTS.find(s=>s.id===id)?.name}</option>)}</select></label><label className="block text-sm">Знайти тему<Input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="max-h-[32rem] space-y-3 overflow-y-auto">{rows.map(t=><article key={t.topicId} className="min-w-0 rounded-xl border border-border p-3"><h3 className="font-medium">{t.title}</h3>{t.links.length?t.links.filter(l=>safeZnoUrl(l.url)).map(l=><div key={l.url}><a className="break-words text-sm underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.title} ↗</a><p className="text-xs text-muted-foreground">{topicCoverageLabel(l.coverage)}</p></div>):<p className="text-sm text-muted-foreground">Підтвердженої добірки поки немає</p>}</article>)}</div></section>;
}
