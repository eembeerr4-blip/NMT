import Link from "next/link";
import { Card } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/constants";
import { ukrainianRouteGaps } from "@/lib/ukrainian-route";

export function UkrainianRoute({ topics, statuses, practiced }: {
  topics: { id: string; title: string }[]; statuses: Map<string, string>; practiced: Set<string>;
}) {
  return <Card id="learning-route" className="d04-material my-6">
    <h2>Порядок доступних уроків</h2>
    <p>Починайте з першого уроку без завершеної практики або поверніться до попереднього. Виконана практика не означає засвоєння: помилки й повторення залишаються у вашому прогресі. Це маршрут наявних матеріалів, а не повний курс НМТ.</p>
    {topics.length ? <ol className="list-decimal space-y-2 pl-5 my-4" aria-label="Доступні уроки української мови">
      {topics.map(topic => <li key={topic.id}><Link className="underline break-words" href={`/learn/${topic.id}`}>{topic.title}</Link><span className="text-sm text-muted-foreground"> · {STATUS_LABEL[statuses.get(topic.id) ?? "NOT_STARTED"]}{practiced.has(topic.id)?" · Практику виконано":""}</span></li>)}
    </ol> : <p>Доступні уроки ще готуються.</p>}
    <details><summary>Чого поки бракує для навчання з нуля</summary><ul className="list-disc pl-5 space-y-2">{ukrainianRouteGaps.map(gap => <li key={gap}>{gap}</li>)}</ul></details>
  </Card>;
}
