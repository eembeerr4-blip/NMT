import { Card } from "@/components/ui";
import { TopicActions } from "@/components/forms";
import mappings from "@/lib/zno-topic-map.json";
import { safeZnoUrl, topicCoverageLabel } from "@/lib/external-practice";
export function ExternalTopicPractice({ topicId, internalAvailable }: { topicId:string; internalAvailable:boolean }) {
  const match=mappings.topics.find(t=>t.topicId===topicId || t.aliases.some((alias:string)=>alias===topicId));
  return <Card className="min-w-0 space-y-3 p-4"><h2 className="font-semibold">Практика за темою</h2><p className="text-sm text-muted-foreground">Повертайтеся до практики у зручний час.</p><div><h3 className="text-sm font-medium">NMT Academy · автоматична перевірка</h3><TopicActions topicId={topicId} hasQuestions={internalAvailable}/></div><h3 className="text-sm font-medium">ZNO Online · зовнішні завдання</h3>{match?.links.length?match.links.filter(l=>safeZnoUrl(l.url)).map(link=><div key={link.url} className="min-w-0 text-sm"><a className="break-words underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.title} ↗</a><p className="text-xs text-muted-foreground">{topicCoverageLabel(link.coverage)}</p></div>):<p className="text-sm text-muted-foreground">Підтвердженої добірки поки немає</p>}</Card>;
}
