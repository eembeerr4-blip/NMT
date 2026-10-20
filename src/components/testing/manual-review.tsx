"use client";
import { useRouter } from "next/navigation";
import { gradeManually } from "@/server/actions";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui";
/** The same gradeManually action with visible transport/server feedback. */
export function ManualReview({ answerId }: { answerId: string }) {
  const { pending, result, run } = useActionFeedback();
  const router = useRouter();
  return <div className="d05-manual-review"><p>Оцініть відповідь після розбору.</p><div><Button type="button" disabled={pending} onClick={()=>void run(()=>gradeManually(answerId,true),()=>router.refresh())}>{pending ? "Збереження…" : "Зарахувати"}</Button><Button type="button" variant="outline" disabled={pending} onClick={()=>void run(()=>gradeManually(answerId,false),()=>router.refresh())}>Не зарахувати</Button></div>{result ? <p role={result.ok ? "status" : "alert"}>{result.ok ? "Оцінку збережено." : result.error}</p> : null}</div>;
}
