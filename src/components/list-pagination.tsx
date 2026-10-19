import Link from "next/link";
import {Button} from "./ui";
export function parseListPage(value?:string) {const page=Number(value);return Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1;}
export function ListPagination({page,total,pageSize=20,pathname,params={}}:{page:number;total:number;pageSize?:number;pathname:string;params?:Record<string,string|undefined>}) {
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const href=(next:number)=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(params))if(value)query.set(key,value);query.set("page",String(next));return `${pathname}?${query}`;};
 return <nav aria-label="Сторінки списку" className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>Знайдено: {total}. Сторінка {page} із {pages}.</span><div className="flex gap-2">{page>1?<Button asChild variant="outline"><Link href={href(page-1)}>Назад</Link></Button>:null}{page<pages?<Button asChild variant="outline"><Link href={href(page+1)}>Далі</Link></Button>:null}</div></nav>;
}
