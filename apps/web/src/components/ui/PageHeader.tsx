import React from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className = ""
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-sand-200 ${className}`}
    >
      <div className="space-y-1 min-w-0">
        {eyebrow && <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-sand-700 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">{actions}</div>}
    </div>
  );
}

