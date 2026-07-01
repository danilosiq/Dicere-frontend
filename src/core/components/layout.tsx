import { ReactNode } from "react";

import { cn } from "@/core/utils/cn";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Row({ children, className }: LayoutProps) {
  return <div className={cn("flex flex-row", className)}>{children}</div>;
}

export function Column({ children, className }: LayoutProps) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}
