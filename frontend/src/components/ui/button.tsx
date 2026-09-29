import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Apple Design Rule: Pill CTAs (rounded-full), weight ladder 400 (normal), press scale 0.95, no shadow
    const baseStyles =
      "inline-flex items-center justify-center font-normal rounded-full transition-transform transition-colors duration-150 active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none";

    const variants = {
      // Primary = Action Blue #0066cc (on dark: #2997ff)
      primary:
        "bg-primary hover:bg-primary-focus text-white",
      // Secondary/Outline = 1px border with Action Blue text
      secondary:
        "bg-canvas hover:bg-parchment text-primary border border-hairline hover:border-primary/40",
      outline:
        "bg-transparent hover:bg-parchment text-primary border border-primary",
      ghost:
        "bg-transparent hover:bg-parchment text-primary",
      // Danger = #ff3b30
      danger:
        "bg-danger hover:opacity-90 text-white",
      success:
        "bg-success hover:opacity-90 text-white",
    };

    const sizes = {
      sm: "text-xs px-3.5 py-1 gap-1.5 h-7",
      md: "text-sm px-5 py-2 gap-2 h-9",
      lg: "text-base px-6 py-2.5 gap-2.5 h-11",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
