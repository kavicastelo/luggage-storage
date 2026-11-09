import React from "react";

export interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rectangular" | "circular";
  width?: string | number;
  height?: string | number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = "rectangular",
  width,
  height,
  className = "",
  style,
  ...props
}) => {
  const variantClasses = {
    text: "h-4 rounded-md",
    rectangular: "rounded-xl",
    circular: "rounded-full",
  }[variant];

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-sand-200/70 ${variantClasses} ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};
