import DicereLogo from "@/core/assets/icons/dicereLogo.svg";
import { Typography } from "@/core/components/typography";
import { cn } from "@/core/utils/cn";

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface LogoProps {
  size?: LogoSize;
  hideText?: boolean;
}

const logoSizeClasses: Record<LogoSize, string> = {
  xs: "h-[19px] w-8",
  sm: "h-[27px] w-[46px]",
  md: "h-9 w-[61px]",
  lg: "h-[45px] w-[77px]",
  xl: "h-[54px] w-[92px]",
};

const textSizes: Record<LogoSize, number> = {
  xs: 20,
  sm: 24,
  md: 30,
  lg: 36,
  xl: 50,
};

const gapClasses: Record<LogoSize, string> = {
  xs: "gap-1.5",
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
  xl: "gap-3",
};

export function Logo({ size = "md", hideText = false }: LogoProps) {
  return (
    <div
      aria-label={hideText ? "Dicere" : undefined}
      className={cn("flex flex-row items-center", gapClasses[size])}
      role={hideText ? "img" : undefined}
    >
      <DicereLogo
        aria-hidden="true"
        className={cn("shrink-0", logoSizeClasses[size])}
      />

      {!hideText && (
        <Typography
          className="leading-none"
          color="gray-600"
          darkColor="gray-100"
          fontFamily="baloo2"
          fontWeight="semibold"
          size={textSizes[size]}
        >
          Dicere
        </Typography>
      )}
    </div>
  );
}
