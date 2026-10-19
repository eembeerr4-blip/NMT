"use client";
import type {ReactNode} from "react";
import {ContentTabs} from "./content-tabs";
type Shared={notes:ReactNode;examples:ReactNode;practice:ReactNode};
type Props=Shared&({variant:"lesson";theory:ReactNode;defaultValue?:"theory"|"practice"}|{variant?:"default";video:ReactNode;defaultValue?:"notes"|"video"|"practice"});
export function LessonTabs(props:Props) {
 if(props.variant==="lesson")return <ContentTabs label="Матеріали уроку" variant="lesson" keepMounted defaultValue={props.defaultValue??"theory"} items={[{value:"theory",label:"Теорія",content:props.theory},{value:"examples",label:"Приклади",content:props.examples},{value:"practice",label:"Практика",content:props.practice},{value:"notes",label:"Конспект",content:props.notes}]}/>;
 return <ContentTabs label="Матеріали уроку" defaultValue={props.defaultValue??"notes"} items={[{value:"video",label:"Відео",content:props.video},{value:"notes",label:"Конспект",content:props.notes},{value:"examples",label:"Приклади",content:props.examples},{value:"practice",label:"Практика",content:props.practice}]}/>;
}
