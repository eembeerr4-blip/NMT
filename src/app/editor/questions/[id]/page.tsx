import { QuestionEditor } from "@/components/question-editor";
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}) { return QuestionEditor({params,basePath:"/editor"}); }
