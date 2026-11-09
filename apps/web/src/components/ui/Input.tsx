import React, { useId } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id: customId,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error);
    const ariaDescribedBy = hasError
      ? errorId
      : helperText
      ? helperId
      : undefined;

    return (
      <div className="w-full text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-navy-900 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative rounded-lg shadow-sm">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sand-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={ariaDescribedBy}
            className={`w-full h-11 min-h-[44px] text-sm text-navy-950 bg-white rounded-lg border transition-colors duration-150
              placeholder:text-sand-400
              focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-500
              disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed
              ${leftIcon ? "pl-10" : "pl-3.5"}
              ${rightIcon ? "pr-10" : "pr-3.5"}
              ${
                hasError
                  ? "border-rose-500 text-rose-900 focus:ring-rose-500/40 focus:border-rose-600"
                  : "border-sand-200 hover:border-sand-300"
              }
              ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-sand-500">
              {rightIcon}
            </div>
          )}
        </div>
        {hasError && (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1" role="alert">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </p>
        )}
        {!hasError && helperText && (
          <p id={helperId} className="mt-1 text-xs text-sand-600">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
