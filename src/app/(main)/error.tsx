"use client";
import {Button,ErrorState} from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState action={<Button onClick={reset} type="button">Спробувати знову</Button>}/>;
}
