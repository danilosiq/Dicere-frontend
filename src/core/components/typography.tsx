import type { ReactNode } from "react";

import {
  textColorPatterns,
  type TextColorPattern,
} from "@/core/styles/color-patterns";
import { baloo2, roboto } from "@/core/styles/fonts";
import { cn } from "@/core/utils/cn";

export type TypographyFontFamily = "roboto" | "baloo2";
export type TypographyFontWeight =
  "thin" | "regular" | "medium" | "semibold" | "bold";
type TypographyPresetSize = "xs" | "sm" | "md" | "lg" | "xl";
export type TypographySize = TypographyPresetSize | number;

export type TypographyProps = {
  children: ReactNode;
  fontFamily?: TypographyFontFamily;
  fontWeight?: TypographyFontWeight;
  size?: TypographySize;
  color?: TextColorPattern;
  darkColor?: TextColorPattern;
  className?: string;
};

const fontFamilyClasses: Record<TypographyFontFamily, string> = {
  roboto: cn("font-roboto", roboto.className),
  baloo2: cn("font-baloo-2", baloo2.className),
};

const fontWeightClasses: Record<TypographyFontWeight, string> = {
  thin: "font-thin",
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const sizeClasses: Record<TypographyPresetSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function Typography({
  children,
  fontFamily = "roboto",
  fontWeight = "regular",
  size = "md",
  color,
  darkColor,
  className,
}: TypographyProps) {
  return (
    <span
      className={cn(
        className,
        fontFamilyClasses[fontFamily],
        fontWeightClasses[fontWeight],
        typeof size === "string" && sizeClasses[size],
        color && textColorPatterns[color].light,
        darkColor && textColorPatterns[darkColor].dark,
      )}
      style={typeof size === "number" ? { fontSize: size } : undefined}
    >
      {children}
    </span>
  );
}
