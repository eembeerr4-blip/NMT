import type { externalAssignments } from "./external-practice";
import type { AssignmentView } from "@/components/external-practice";
export function assignmentView(row:Awaited<ReturnType<typeof externalAssignments>>[number]):AssignmentView {
  return {id:row.id,subjectId:row.subjectId,title:row.title,variantNumber:row.variantNumber,url:row.url,questionCount:row.questionCount,status:row.status,version:row.version,date:row.task.dateKey,result:row.result?{date:row.result.date.toISOString().slice(0,10),rawScore:row.result.rawScore,maxRawScore:row.result.maxRawScore,ratingScore:row.result.ratingScore,errorCount:row.result.errorCount,comment:row.result.comment}:null};
}
