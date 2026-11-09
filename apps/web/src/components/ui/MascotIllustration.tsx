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
        <div className="relative flex-shrink-0 rounded-2xl bg-sand-100/90 border border-sand-200 p-1.5 shadow-sm">
          <picture>
            <source srcSet={meta.webpPath} type="image/webp" />
            <img
              src={meta.publicPath}
              alt={meta.alt}
              className={`${SIZE_CLASSES[size]} object-contain select-none`}
              loading="lazy"
            />
          </picture>
        </div>
        {(badgeText || caption) && (
          <div className="text-left">
            {badgeText && (
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-terracotta-700 bg-terracotta-100 px-2 py-0.5 rounded-full mb-1">
                {badgeText}
              </span>
            )}
            {caption && <p className="text-xs sm:text-sm text-sand-700 font-medium">{caption}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center text-center rounded-2xl ${
        variant === "hero"
          ? "bg-gradient-to-br from-terracotta-50 via-white to-sand-50 border border-sand-200 p-6 shadow-md"
          : variant === "empty"
          ? "bg-sand-50/90 border border-dashed border-sand-300 p-8"
          : "bg-sand-100/50 border border-sand-200 p-4"
      } ${className}`}
      data-mascot-id={meta.id}
    >
      {badgeText && (
        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-terracotta-800 bg-terracotta-100 border border-terracotta-200 px-2.5 py-0.5 rounded-full mb-2">
          {badgeText}
        </span>
      )}
      <picture>
        <source srcSet={meta.webpPath} type="image/webp" />
        <img
          src={meta.publicPath}
          alt={meta.alt}
          className={`${SIZE_CLASSES[size]} object-contain select-none drop-shadow-sm`}
          loading="lazy"
        />
      </picture>
      {caption && (
        <p className="mt-2.5 text-xs sm:text-sm text-sand-700 max-w-sm font-medium leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  );

}

