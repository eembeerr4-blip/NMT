"use client";
import type {ReactNode} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {X} from "lucide-react";

export function PanelDialog({title,description,trigger,children}:{title:string;description:string;trigger:ReactNode;children:ReactNode}) {
 return <Dialog.Root><Dialog.Trigger asChild>{trigger}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/60"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6"><Dialog.Title className="pr-8 text-xl font-semibold">{title}</Dialog.Title><Dialog.Description className="text-sm leading-6 text-muted-foreground">{description}</Dialog.Description>{children}<Dialog.Close aria-label="Закрити вікно" className="absolute right-3 top-3 rounded-xl p-2 hover:bg-muted"><X className="h-5 w-5"/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
