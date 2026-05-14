import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leading?: React.ReactNode;
};

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, hint, error, leading, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? Math.random().toString(36).slice(2);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground tracking-wide">
          {label}
        </label>
      )}
      <div className={cn(
        "group relative flex items-center rounded-lg border bg-elevated/60 transition-all",
        "border-border focus-within:border-primary/60 focus-within:bg-elevated focus-within:shadow-[0_0_0_4px_oklch(0.72_0.18_255_/_0.12)]",
        error && "border-destructive/60 focus-within:border-destructive focus-within:shadow-[0_0_0_4px_oklch(0.66_0.22_22_/_0.18)]",
      )}>
        {leading && <span className="pl-3 text-muted-foreground">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full bg-transparent px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none",
            leading && "pl-2",
            className,
          )}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{error ?? hint}</span>
      )}
    </div>
  );
});
