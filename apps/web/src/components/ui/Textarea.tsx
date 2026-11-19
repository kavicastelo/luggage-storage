import React, { useId } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, id: customId, className = "", ...props }, ref) => {
    const generatedId = useId();
    const textareaId = customId || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;
    const hasError = Boolean(error);

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-semibold text-navy-900 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={`w-full min-h-[96px] p-3.5 text-sm text-navy-950 bg-white rounded-lg border shadow-sm transition-colors duration-150
            placeholder:text-sand-500
            focus:outline-none focus:ring-2 focus:ring-terracotta-500/50 focus:border-terracotta-500
            disabled:bg-sand-100 disabled:text-sand-500 disabled:cursor-not-allowed
            ${hasError ? "border-rose-500 text-rose-900" : "border-sand-200 hover:border-sand-300"}
            ${className}`}
          {...props}
        />
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

Textarea.displayName = "Textarea";

