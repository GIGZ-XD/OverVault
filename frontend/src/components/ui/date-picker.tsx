import React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

export interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-xs font-medium text-text-muted">{label}</label>}
        <div className="relative flex items-center">
          <Calendar className="absolute left-3 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="datetime-local"
            ref={ref}
            className={cn(
              "w-full h-10 rounded-sm border border-border bg-surface-2 pl-9 pr-3 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-150 [color-scheme:dark]",
              error && "border-danger focus:border-danger focus:ring-danger",
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
