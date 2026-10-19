import Link from "next/link";
import type {ReactNode} from "react";
import {Button,Card} from "./ui";

/** Query/filter/pagination remain server-owned; rows retain semantic table markup. */
export function DataTable({caption,columns,children,filters,pagination}:{caption:string;columns:string[];children:ReactNode;filters?:ReactNode;pagination?:{page:number;pages:number;previous?:string;next?:string}}) {
  return <div className="space-y-4">{filters?<Card className="p-4 sm:p-5">{filters}</Card>:null}<Card className="overflow-hidden"><table className="responsive-table w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="border-b border-border bg-muted/60 text-muted-foreground"><tr>{columns.map(label=><th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></Card>{pagination?<nav aria-label={`Сторінки: ${caption}`} className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">Сторінка {pagination.page} із {pagination.pages}</p><div className="flex gap-2">{pagination.previous?<Button asChild variant="outline" size="sm"><Link href={pagination.previous}>Назад</Link></Button>:null}{pagination.next?<Button asChild variant="outline" size="sm"><Link href={pagination.next}>Далі</Link></Button>:null}</div></nav>:null}</div>;
}
