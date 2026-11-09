import React from "react";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "navy"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, { container: string; dot: string }> = {
  neutral: {
    container: "bg-sand-100 text-navy-900 border-sand-200",
    dot: "bg-sand-500",
  },
  brand: {
    container: "bg-terracotta-100 text-terracotta-800 border-terracotta-200",
    dot: "bg-terracotta-500",
  },
  navy: {
    container: "bg-navy-100 text-navy-900 border-navy-200",
    dot: "bg-navy-700",
  },
  success: {
    container: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  warning: {
    container: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  danger: {
    container: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
  info: {
    container: "bg-sky-50 text-sky-800 border-sky-200",
    dot: "bg-sky-500",
  },
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs rounded-md gap-1",
  md: "px-2.5 py-1 text-xs sm:text-sm rounded-lg gap-1.5",
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "sm",
  dot = false,
  icon,
  children,
  className = "",
  ...props
}) => {
  const styles = VARIANT_CLASSES[variant];

  return (
    <span
      className={`inline-flex items-center font-medium border select-none ${styles.container} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
