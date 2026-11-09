import React from "react";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
  onDismiss?: () => void;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { container: string; title: string; body: string; defaultIcon: React.ReactNode }
> = {
  info: {
    container: "bg-sky-50 border-sky-200 text-sky-900",
    title: "text-sky-950 font-semibold",
    body: "text-sky-800",
    defaultIcon: (
      <svg className="w-5 h-5 text-sky-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  success: {
    container: "bg-emerald-50 border-emerald-200 text-emerald-900",
    title: "text-emerald-950 font-semibold",
    body: "text-emerald-800",
    defaultIcon: (
      <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-900",
    title: "text-amber-950 font-semibold",
    body: "text-amber-800",
    defaultIcon: (
      <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  danger: {
    container: "bg-rose-50 border-rose-200 text-rose-900",
    title: "text-rose-950 font-semibold",
    body: "text-rose-800",
    defaultIcon: (
      <svg className="w-5 h-5 text-rose-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  icon,
  onDismiss,
  children,
  className = "",
  ...props
}) => {
  const config = VARIANT_CONFIG[variant];
  const role = variant === "danger" || variant === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`rounded-xl border p-4 transition-all duration-150 ${config.container} ${className}`}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icon || config.defaultIcon}</div>
        <div className="flex-1 text-sm">
          {title && <h4 className={`text-sm mb-1 ${config.title}`}>{title}</h4>}
          <div className={`leading-relaxed ${config.body}`}>{children}</div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="p-1 -mr-1 -mt-1 rounded-lg text-sand-500 hover:text-navy-950 hover:bg-sand-200/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
