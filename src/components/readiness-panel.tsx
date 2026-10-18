import Link from "next/link";
import { lessonReadiness } from "@/lib/readiness";
import { Card } from "./ui";
export function ReadinessPanel({topic}:{topic:Parameters<typeof lessonReadiness>[0]}){
 const r=lessonReadiness(topic);
 return <Card className="space-y-2 p-4"><h2 className="font-medium">{r.section?'Розділ програми':r.ready?'Навчальний комплект зібрано':'Матеріали теми'}</h2>
 <ul className="grid gap-1 text-sm sm:grid-cols-2"><li>Теорія: {r.theory?'розгорнуте пояснення':'потрібне доопрацювання'}</li><li>Приклади: {r.examples?'щонайменше два':'потрібне доповнення'}</li><li>Практика: {r.questionCount} завдань {r.practice?'· можна пройти тест':'· доступна практика'}</li><li>Відео: {r.video?'додано редактором':'ще не підтверджено'}</li></ul>
 {!r.ready?<p className="text-sm text-muted-foreground">{r.section?'Оберіть урок усередині розділу.':'Можна вивчати доступний матеріал. Неповний комплект не позначено готовим курсом.'}</p>:null}
 <Link className="text-sm underline" href="/curriculum">Переглянути готовність усіх тем</Link></Card>;
}
