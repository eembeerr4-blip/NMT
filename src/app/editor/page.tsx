import {redirect} from "next/navigation";import {requireContentEditor} from "@/server/session";export default async function Page(){await requireContentEditor();redirect("/editor/lessons");}
