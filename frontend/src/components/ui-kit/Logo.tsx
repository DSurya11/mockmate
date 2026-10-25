import { cn } from "@/lib/utils";

/** A speech mark in an ink square, and the name set in the display serif. */
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="grid place-items-center rounded-[5px] bg-primary text-primary-foreground"
        style={{ width: size + 4, height: size + 4 }}
        aria-hidden
      >
        <svg width={size - 6} height={size - 6} viewBox="0 0 24 24" fill="none">
          <path d="M5 6.5h14v8.5h-7l-4.5 3.5V15H5z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="font-display text-[17px] font-semibold tracking-tight">MockMate</span>
    </div>
  );
}
