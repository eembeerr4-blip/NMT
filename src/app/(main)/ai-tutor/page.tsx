import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";

export default async function TutorPage() {
  await requireUser();
  redirect("/");
}
