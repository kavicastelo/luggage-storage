import React, { useEffect, useId } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
}

const MAX_WIDTHS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl"
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer,
  closeLabel = "Close dialog"
}: ModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-[2px] animate-cwcp-fade"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${MAX_WIDTHS[size]} max-h-[90vh] flex flex-col rounded-2xl bg-white border border-sand-200 shadow-2xl overflow-hidden animate-cwcp-scale`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-sand-200 bg-sand-50/70">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-navy-950 tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs sm:text-sm text-sand-700 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="touch-target -mr-2 -mt-1 rounded-xl text-sand-700 hover:text-navy-950 hover:bg-sand-200/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-sand-200 bg-sand-50/60 flex flex-wrap items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

