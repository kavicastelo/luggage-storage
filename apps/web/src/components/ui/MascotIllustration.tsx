import React from "react";
import { getMascotMeta, MascotKey } from "@/lib/mascots";

export interface MascotIllustrationProps {
  mascot: MascotKey;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  caption?: string;
  badgeText?: string;
  className?: string;
  variant?: "bare" | "spotlight" | "card" | "inline" | "hero" | "empty";
  decorative?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<MascotIllustrationProps["size"]>, string> = {
  xs: "w-12 h-12",
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-44 h-44",
  "2xl": "w-52 h-52 sm:w-60 sm:h-60"
};

export function MascotIllustration({
  mascot,
  size = "md",
  caption,
  badgeText,
  className = "",
  variant = "inline",
  decorative = false
}: MascotIllustrationProps) {
  const meta = getMascotMeta(mascot);
  const altText = decorative ? "" : meta.alt;

  if (variant === "bare" || variant === "spotlight") {
    return (
      <div
        className={`relative flex flex-col items-center text-center ${className}`}
        data-mascot-id={meta.id}
        aria-hidden={decorative || undefined}
      >
        {variant === "spotlight" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-4 rounded-full bg-terracotta-500/20 blur-2xl"
          />
        )}
        {badgeText && (
          <span className="relative z-10 inline-block text-[11px] font-bold uppercase tracking-wider text-terracotta-800 bg-terracotta-100 border border-terracotta-200 px-2.5 py-0.5 rounded-full mb-2">
            {badgeText}
          </span>
        )}
        <div className="relative z-10">
          <picture>
            <source srcSet={meta.webpPath} type="image/webp" />
            <img
              src={meta.publicPath}
              alt={altText}
              className={`${SIZE_CLASSES[size]} object-contain select-none drop-shadow-[0_12px_20px_rgba(7,14,26,0.18)]`}
              loading="lazy"
            />
          </picture>
        </div>
        {caption && (
          <p className="relative z-10 mt-2.5 text-xs sm:text-sm text-sand-700 max-w-sm font-medium leading-relaxed">
            {caption}
          </p>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={`inline-flex items-center gap-3 ${className}`}
        data-mascot-id={meta.id}
        aria-hidden={decorative || undefined}
      >
        <span className="flex-shrink-0">
          <picture>
            <source srcSet={meta.webpPath} type="image/webp" />
            <img
              src={meta.publicPath}
              alt={altText}
              className={`${SIZE_CLASSES[size]} object-contain select-none drop-shadow-sm`}
              loading="lazy"
            />
          </picture>
        </span>
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
          ? "bg-white/10 backdrop-blur-sm border border-white/15 p-6 shadow-xl text-white"
          : variant === "empty"
          ? "py-6 px-4"
          : "bg-sand-100/60 border border-sand-200 p-4"
      } ${className}`}
      data-mascot-id={meta.id}
      aria-hidden={decorative || undefined}
    >
      {badgeText && (
        <span
          className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2 ${
            variant === "hero"
              ? "bg-terracotta-500/25 text-terracotta-200 border border-terracotta-400/40"
              : "text-terracotta-800 bg-terracotta-100 border border-terracotta-200"
          }`}
        >
          {badgeText}
        </span>
      )}
      <picture>
        <source srcSet={meta.webpPath} type="image/webp" />
        <img
          src={meta.publicPath}
          alt={altText}
          className={`${SIZE_CLASSES[size]} object-contain select-none drop-shadow-md`}
          loading="lazy"
        />
      </picture>
      {caption && (
        <p
          className={`mt-2.5 text-xs sm:text-sm max-w-sm font-medium leading-relaxed ${
            variant === "hero" ? "text-sand-200" : "text-sand-700"
          }`}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
