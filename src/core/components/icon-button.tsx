"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/core/utils/cn";

export type IconButtonProps = {
  icon: ReactNode;
  tooltip?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
};

export function IconButton({
  icon,
  tooltip,
  ariaLabel,
  disabled = false,
  className,
  onClick,
}: IconButtonProps) {
  const button = (
    <Button
      aria-label={ariaLabel ?? tooltip}
      className={cn(
        "hover:bg-primary-green dark:hover:bg-primary-green relative size-10 rounded-full p-1.5 text-gray-400 hover:text-white active:scale-95 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:active:scale-100 dark:text-gray-200 dark:disabled:hover:text-gray-200",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      size="unset"
      type="button"
      variant="ghost"
    >
      <span
        aria-hidden="true"
        className="size-5 scale-100 opacity-100 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none [&>svg]:size-5"
      >
        {icon}
      </span>
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
