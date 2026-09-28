import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  pill?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, pill, leftIcon, rightIcon, type = "text", ...props }, ref) => {
    // Apple Design: 1px hairline default -> primary on focus -> danger on error
    // Radius: radius.md (10px) or pill (rounded-full) for search
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && <label className="text-xs font-semibold text-ink">{label}</label>}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-ink-muted-48 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              "w-full h-9 border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted-48 font-normal transition-colors duration-150 focus:outline-none focus:border-primary",
              pill ? "rounded-full px-4" : "rounded-[10px]",
              leftIcon && (pill ? "pl-10" : "pl-9"),
              rightIcon && (pill ? "pr-10" : "pr-9"),
              error && "border-danger focus:border-danger",
              className
            )}
            {...props}
          />
          {rightIcon && <div className="absolute right-3 text-ink-muted-48 flex items-center">{rightIcon}</div>}
        </div>
        {error && <span className="text-xs text-danger font-normal">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
