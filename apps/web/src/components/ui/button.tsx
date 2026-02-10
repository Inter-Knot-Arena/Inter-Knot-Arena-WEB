import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ika-900 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-accent-400/40 bg-gradient-to-r from-accent-600 to-accent-500 text-white shadow-card hover:-translate-y-0.5 hover:brightness-110",
        secondary:
          "border border-border bg-ika-700/80 text-ink-900 hover:-translate-y-0.5 hover:border-accent-400/40 hover:bg-ika-600",
        outline:
          "border border-border bg-ika-900/35 text-ink-900 backdrop-blur-sm hover:-translate-y-0.5 hover:border-accent-400/45 hover:bg-ika-700/60",
        ghost: "bg-transparent text-ink-700 hover:text-ink-900 hover:bg-ika-700/40",
        destructive: "bg-red-600 text-white hover:bg-red-500"
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-6",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
