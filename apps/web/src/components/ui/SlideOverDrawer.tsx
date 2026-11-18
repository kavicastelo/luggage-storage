import React, { useEffect, useId } from "react";
import { X } from "lucide-react";

export interface SlideOverDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  ariaLabel?: string;
}

const WIDTH_CLASSES: Record<NonNullable<SlideOverDrawerProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl"
};

export function SlideOverDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  size = "lg",
  children,
  footer,
  closeLabel = "Close inspector",
  ariaLabel
}: SlideOverDrawerProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-navy-950/55 backdrop-blur-[2px] animate-cwcp-fade"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        className={`w-full ${WIDTH_CLASSES[size]} h-full bg-white border-l border-sand-200 shadow-2xl flex flex-col animate-cwcp-drawer`}
      >
        <div className="px-6 py-4 border-b border-sand-200 bg-sand-50/80 flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {badge && <div className="flex flex-wrap items-center gap-2">{badge}</div>}
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-navy-950 tracking-tight truncate">
              {title}
            </h2>
            {subtitle && <p className="text-xs sm:text-sm text-sand-700">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="touch-target -mr-2 -mt-1 rounded-xl text-sand-700 hover:text-navy-950 hover:bg-sand-200/70 transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-sand-200 bg-sand-50/80 flex flex-wrap items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}

