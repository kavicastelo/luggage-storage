import React from "react";

interface SvgElementProps {
  children?: React.ReactNode;
  testID?: string;
  viewBox?: string;
  width?: number | string;
  height?: number | string;
  d?: string;
  x?: number | string;
  y?: number | string;
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
  rx?: number | string;
  ry?: number | string;
  x1?: number | string;
  y1?: number | string;
  x2?: number | string;
  y2?: number | string;
  points?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  className?: string;
}

function createSvgMock(tagName: string, displayName: string) {
  const Comp = React.forwardRef<unknown, SvgElementProps>(
    ({ children, testID, ...rest }, ref) =>
      React.createElement(
        tagName,
        {
          ...rest,
          ref,
          ...(testID ? { "data-testid": testID } : {})
        },
        children
      )
  );
  Comp.displayName = displayName;
  return Comp;
}

export const Svg = createSvgMock("svg", "Svg");
export const Path = createSvgMock("path", "Path");
export const Circle = createSvgMock("circle", "Circle");
export const Rect = createSvgMock("rect", "Rect");
export const Line = createSvgMock("line", "Line");
export const Polygon = createSvgMock("polygon", "Polygon");
export const Polyline = createSvgMock("polyline", "Polyline");
export const Ellipse = createSvgMock("ellipse", "Ellipse");
export const G = createSvgMock("g", "G");
export const Defs = createSvgMock("defs", "Defs");
export const ClipPath = createSvgMock("clipPath", "ClipPath");
export const Use = createSvgMock("use", "Use");
export const Text = createSvgMock("text", "SvgText");
export const TSpan = createSvgMock("tspan", "TSpan");

export default Svg;
