import React from "react";
import { getMascotMeta, MascotKey } from "@/lib/mascots";

export interface MascotIllustrationProps {
  mascot: MascotKey;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  caption?: string;
  badgeText?: string;
  className?: string;
  variant?: "card" | "inline" | "hero" | "empty";
}

const SIZE_CLASSES: Record<NonNullable<MascotIllustrationProps["size"]>, string> = {
  xs: "w-12 h-12",
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-44 h-44"
};

export function MascotIllustration({
  mascot,
  size = "md",
  caption,
  badgeText,
  className = "",
  variant = "inline"
}: MascotIllustrationProps) {
  const meta = getMascotMeta(mascot);

  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`} data-mascot-id={meta.id}>
        <div className="relative flex-shrink-0 rounded-2xl bg-amber-50/80 border border-amber-200/70 p-1.5 shadow-sm">
          <img
            src={meta.publicPath}
            alt={meta.alt}
            className={`${SIZE_CLASSES[size]} object-contain select-none`}
            loading="lazy"
          />
        </div>
        {(badgeText || caption) && (
          <div className="text-left">
            {badgeText && (
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full mb-1">
                {badgeText}
              </span>
            )}
            {caption && <p className="text-xs sm:text-sm text-slate-600 font-medium">{caption}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center text-center rounded-2xl ${
        variant === "hero"
          ? "bg-gradient-to-br from-amber-50 via-white to-blue-50 border border-amber-200/80 p-6 shadow-md"
          : variant === "empty"
          ? "bg-slate-50/90 border border-dashed border-slate-300 p-8"
          : "bg-amber-50/50 border border-amber-100 p-4"
      } ${className}`}
      data-mascot-id={meta.id}
    >
      {badgeText && (
        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full mb-2">
          {badgeText}
        </span>
      )}
      <img
        src={meta.publicPath}
        alt={meta.alt}
        className={`${SIZE_CLASSES[size]} object-contain select-none drop-shadow-sm`}
        loading="lazy"
      />
      {caption && (
        <p className="mt-2.5 text-xs sm:text-sm text-slate-600 max-w-sm font-medium leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  );
}

