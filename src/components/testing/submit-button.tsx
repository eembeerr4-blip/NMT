"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
/** Pending presentation for the existing server forms; no new mutation contract. */
export function TestingSubmitButton({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending}>{pending ? "Збереження…" : children}</Button>;
}
