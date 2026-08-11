"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

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
  secondIcon?: ReactNode;
  isActive?: boolean;
  tooltip?: string;
  ariaLabel?: string;
  ariaBusy?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
};

export function IconButton({
  icon,
  secondIcon,
  isActive,
  tooltip,
  ariaLabel,
  ariaBusy,
  disabled = false,
  className,
  onClick,
  type = "button",
}: IconButtonProps) {
  const button = (
    <Button
      aria-label={ariaLabel ?? tooltip}
      aria-busy={ariaBusy}
      aria-pressed={isActive === undefined ? undefined : isActive}
      className={cn(
        "hover:bg-primary-green dark:hover:bg-primary-green relative size-10 rounded-full p-1.5 text-gray-400 hover:text-white active:scale-95 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:active:scale-100 dark:text-gray-200 dark:disabled:hover:text-gray-200",
        className,
        isActive &&
          "bg-primary-purple hover:bg-primary-purple/90 dark:bg-primary-purple dark:hover:bg-primary-purple/90 text-white hover:text-white dark:text-white",
      )}
      data-state={isActive === undefined ? undefined : isActive ? "on" : "off"}
      disabled={disabled}
      onClick={onClick}
      size="unset"
      type={type}
      variant="ghost"
    >
      <span
        aria-hidden="true"
        className="size-5 scale-100 opacity-100 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none [&>svg]:size-5"
      >
        {isActive && secondIcon ? secondIcon : icon}
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
