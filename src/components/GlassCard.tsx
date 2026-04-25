import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, elevated, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        elevated ? "glass-elevated" : "glass",
        "rounded-2xl p-6 transition-all duration-300",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
