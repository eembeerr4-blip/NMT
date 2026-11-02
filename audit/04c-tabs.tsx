"use client";
import type {ReactNode} from "react";
import {ContentTabs} from "./content-tabs";
export function LessonTabs({video,notes,examples,practice,defaultValue="notes"}:{video:ReactNode;notes:ReactNode;examples:ReactNode;practice:ReactNode;defaultValue?:"notes"|"video"|"practice"}) {
 return <ContentTabs label="Матеріали уроку" defaultValue={defaultValue} items={[{value:"video",label:"Відео",content:video},{value:"notes",label:"Конспект",content:notes},{value:"examples",label:"Приклади",content:examples},{value:"practice",label:"Практика",content:practice}]}/>;
}
