"use client";

import { LoaderCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";

export type ButtonVariant = "primary" | "secondary";
export type ButtonRounded = "sm" | "md" | "lg" | "full";

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  rounded?: ButtonRounded;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  width?: number | "full";
  height?: number | "full";
  paddingX?: number;
  paddingY?: number;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  onClick?: () => void;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-green hover:bg-primary-green/90 active:bg-primary-green/80 focus-visible:ring-primary-green",
  secondary:
    "bg-primary-purple hover:bg-primary-purple/90 active:bg-primary-purple/80 focus-visible:ring-primary-purple",
};

const roundedClasses: Record<ButtonRounded, string> = {
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-[20px]",
  full: "rounded-full",
};

export function Button({
  label,
  variant = "primary",
  rounded = "full",
  startIcon,
  endIcon,
  width,
  height,
  paddingX = 18,
  paddingY = 6,
  disabled = false,
  loading = false,
  type = "button",
  className,
  onClick,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const dynamicStyles: CSSProperties = {
    width: width === "full" ? "100%" : width,
    height: height === "full" ? "100%" : height,
    paddingInline: paddingX,
    paddingBlock: paddingY,
  };

  return (
    <ShadcnButton
      aria-busy={loading || undefined}
      aria-label={loading ? label : undefined}
      className={cn(
        "focus-visible:ring-offset-background text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100 dark:disabled:bg-gray-400 dark:disabled:text-gray-600",
        variantClasses[variant],
        roundedClasses[rounded],
        width === "full" && "w-full",
        height === "full" && "h-full",
        className,
      )}
      disabled={isDisabled}
      onClick={onClick}
      size="unset"
      style={dynamicStyles}
      type={type}
      variant={variant === "secondary" ? "secondary" : "default"}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      ) : (
        <>
          {startIcon}
          <span>{label}</span>
          {endIcon}
        </>
      )}
    </ShadcnButton>
  );
}
