import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Primary CTA: Ceylon Terracotta (#C55013) with white text (>4.5:1 strict unrounded contrast)
  primary:
    "bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white shadow-sm hover:shadow focus-visible:ring-terracotta-500",

  // Secondary: Coastal Navy (#0A192F) with white text (>17:1 contrast)
  secondary:
    "bg-navy-900 hover:bg-navy-800 active:bg-navy-950 text-white shadow-sm hover:shadow focus-visible:ring-navy-900",
  // Outline: Sand border with subtle hover tint
  outline:
    "bg-transparent border border-sand-200 hover:bg-sand-100/70 text-navy-900 active:bg-sand-200/50 focus-visible:ring-sand-400",
  // Ghost: Transparent with hover
  ghost:
    "bg-transparent hover:bg-sand-100 text-navy-900 active:bg-sand-200/60 focus-visible:ring-sand-400",
  // Danger: Rose (#E11D48) with white text
  danger:
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm focus-visible:ring-rose-500",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs sm:text-sm min-h-[36px] rounded-md gap-1.5",
  md: "h-11 px-4 text-sm font-medium min-h-[44px] min-w-[44px] rounded-lg gap-2", // 44px ergonomic touch target
  lg: "h-12 px-6 text-base font-semibold min-h-[48px] rounded-xl gap-2.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          ${VARIANT_CLASSES[variant]}
          ${SIZE_CLASSES[size]}
          ${className}`}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
