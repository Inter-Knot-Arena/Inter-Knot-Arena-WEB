import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-ika-700/70 px-2.5 py-0.5 text-xs font-semibold text-ink-900",
        className
      )}
      {...props}
    />
  );
}
