"use client";
import type {ReactNode} from "react";
import * as Tabs from "@radix-ui/react-tabs";

export function ContentTabs({label,items,defaultValue,variant="default",keepMounted=false}:{label:string;items:{value:string;label:string;content:ReactNode}[];defaultValue?:string;variant?:"default"|"lesson";keepMounted?:boolean}) {
 return <Tabs.Root defaultValue={defaultValue??items[0]?.value} className={variant==="lesson"?"d04-tabs space-y-4":"space-y-4"}><Tabs.List aria-label={label} className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted p-1">{items.map(item=><Tabs.Trigger key={item.value} value={item.value} className="min-h-10 flex-1 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:bg-action data-[state=active]:text-primary-foreground">{item.label}</Tabs.Trigger>)}</Tabs.List>{items.map(item=><Tabs.Content key={item.value} value={item.value} forceMount={keepMounted?true:undefined} className={`space-y-4 focus-visible:outline-ring${keepMounted?" data-[state=inactive]:hidden":""}`}>{item.content}</Tabs.Content>)}</Tabs.Root>;
}
