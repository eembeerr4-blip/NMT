import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-muted text-foreground hover:bg-accent",
        outline: "border border-border bg-card hover:bg-accent",
        ghost: "hover:bg-accent",
        destructive: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, asChild = false, ...props }: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn("h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn("min-h-28 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none", props.className)} />;
}

export function Label(props: ComponentProps<"label">) {
  return <label {...props} className={cn("text-sm font-medium", props.className)} />;
}

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} role="progressbar">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}
