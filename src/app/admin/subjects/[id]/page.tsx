import Link from "next/link";
import {notFound} from "next/navigation";
import {Button,Card,PageHeader} from "@/components/ui";
import {SubjectEditor} from "@/components/subject-editor";
import {prisma} from "@/lib/prisma";
import {isAdministrator} from "@/lib/permissions";
import {requireContentEditor} from "@/server/session";
export const dynamic="force-dynamic";
export default async function EditSubject({params}:{params:Promise<{id:string}>}){const user=await requireContentEditor();const {id}=await params;const subject=await prisma.subject.findUnique({where:{id}});if(!subject)notFound();const base=isAdministrator(user)?"/admin":"/editor";return <><PageHeader title={subject.name} description="Назва та опис спільного навчального предмета." action={<Button asChild variant="outline"><Link href={`${base}/subjects`}>До предметів</Link></Button>}/><Card className="p-5 sm:p-6"><SubjectEditor subject={{id,name:subject.name,shortName:subject.shortName,description:subject.description}}/></Card></>;}
