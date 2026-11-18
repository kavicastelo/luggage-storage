import React, { useId } from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, id: customId, className = "", children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = customId || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;
    const hasError = Boolean(error);

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-navy-900 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={`w-full h-11 min-h-[44px] px-3.5 text-sm text-navy-950 bg-white rounded-lg border shadow-sm transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-500
            disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed
            ${hasError ? "border-rose-500 text-rose-900" : "border-sand-200 hover:border-sand-300"}
            ${className}`}
          {...props}
        >
          {children}
        </select>
        {hasError && (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}
        {!hasError && helperText && (
          <p id={helperId} className="mt-1 text-xs text-sand-700">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

