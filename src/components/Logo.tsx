import { Zap } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${dim} flex items-center justify-center rounded-xl btn-glow shadow-lg`}
        aria-hidden
      >
        <Zap className="h-1/2 w-1/2" strokeWidth={2.5} />
      </div>
      <span className={`${text} font-bold tracking-tight`}>
        Proxi<span className="gradient-text">Pay</span>
      </span>
    </div>
  );
}
