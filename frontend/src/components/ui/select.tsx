import React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && <label className="text-xs font-semibold text-ink">{label}</label>}
        <select
          ref={ref}
          className={cn(
            "w-full h-9 rounded-[10px] border border-hairline bg-canvas px-3.5 py-1.5 text-sm text-ink font-normal focus:outline-none focus:border-primary transition-colors duration-150 cursor-pointer",
            error && "border-danger focus:border-danger",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-canvas text-ink">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-danger font-normal">{error}</span>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
