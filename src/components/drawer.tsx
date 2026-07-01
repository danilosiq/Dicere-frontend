"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import {
  Drawer as ShadcnDrawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Column, Row } from "@/core/components/layout";
import { cn } from "@/core/utils/cn";

export enum DrawerDirection {
  LEFT = "left",
  RIGHT = "right",
  TOP = "top",
  BOTTOM = "bottom",
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  direction?: DrawerDirection;
  enableCloseButton?: boolean;
};

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeToMobileQuery(onStoreChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onStoreChange);

  return () => query.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    getServerSnapshot,
  );
}

const contentClasses: Record<DrawerDirection, string> = {
  [DrawerDirection.BOTTOM]: "max-h-[90vh] w-full rounded-t-2xl",
  [DrawerDirection.LEFT]: "h-full w-[min(90vw,28rem)] rounded-r-2xl",
  [DrawerDirection.RIGHT]: "h-full w-[min(90vw,28rem)] rounded-l-2xl",
  [DrawerDirection.TOP]: "max-h-[90vh] w-full rounded-b-2xl",
};

export function Drawer({
  open,
  onClose,
  children,
  title,
  direction = DrawerDirection.RIGHT,
  enableCloseButton = false,
}: DrawerProps) {
  const resolvedDirection = useIsMobile() ? DrawerDirection.BOTTOM : direction;
  const hasHeader = Boolean(title || enableCloseButton);

  return (
    <ShadcnDrawer
      direction={resolvedDirection}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
    >
      <DrawerContent
        aria-describedby={undefined}
        className={cn(
          "bg-white dark:bg-gray-800",
          contentClasses[resolvedDirection],
        )}
      >
        <Column className="max-h-full min-h-0 w-full overflow-hidden">
          {hasHeader ? (
            <Row className="border-border min-h-16 items-center justify-between gap-4 border-b px-6 py-4">
              {title ? (
                <DrawerTitle className="font-display text-xl font-semibold">
                  {title}
                </DrawerTitle>
              ) : null}

              {enableCloseButton ? (
                <button
                  aria-label="Fechar drawer"
                  className="hover:text-foreground focus-visible:ring-brand-green ml-auto flex size-9 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  onClick={onClose}
                  type="button"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              ) : null}
            </Row>
          ) : null}

          <Column className="min-h-0 flex-1 overflow-y-auto p-6">
            {children}
          </Column>
        </Column>
      </DrawerContent>
    </ShadcnDrawer>
  );
}

export type { DrawerProps };
