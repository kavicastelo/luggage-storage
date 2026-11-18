import React from "react";
import type { MascotKey } from "@/lib/mascots";
import { MascotIllustration } from "./MascotIllustration";

export interface EmptyStateProps {
  title: string;
  description: string;
  mascot?: MascotKey;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  mascot,
  icon,
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-sand-200 bg-white px-6 py-10 text-center flex flex-col items-center justify-center ${className}`}
    >
      {mascot ? (
        <MascotIllustration mascot={mascot} size="lg" variant="bare" decorative />
      ) : (
        icon && (
          <div className="w-14 h-14 rounded-2xl bg-sand-100 border border-sand-200 flex items-center justify-center text-navy-900 mb-3">
            {icon}
          </div>
        )
      )}
      <h3 className="text-lg font-bold text-navy-950 mt-3">{title}</h3>
      <p className="text-sm text-sand-700 max-w-md mt-1.5 leading-relaxed">{description}</p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}

