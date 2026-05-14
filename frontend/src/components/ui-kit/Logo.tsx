import { cn } from "@/lib/utils";

export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative grid place-items-center rounded-lg bg-gradient-primary shadow-glow"
        style={{ width: size + 8, height: size + 8 }}
      >
        <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="none" className="text-primary-foreground">
          <path d="M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="14" r="2.2" fill="currentColor" />
          <path d="M9 19h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
      <span className="font-semibold tracking-tight text-[15px]">
        Mock<span className="text-gradient">Mate</span>
      </span>
    </div>
  );
}

