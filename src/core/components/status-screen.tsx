"use client";

import { Button } from "./button";
import { Header } from "./header";
import { Column } from "./layout";
import { Logo } from "./logo";
import { Typography } from "./typography";

type StatusScreenProps = {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
};

export function StatusScreen({
  title,
  description,
  actionLabel,
  onAction,
}: StatusScreenProps) {
  return (
    <Column className="bg-background text-foreground min-h-screen gap-6 p-6">
      <Header />
      <Column className="m-auto max-w-xl items-center gap-6 text-center">
        <Logo size="xl" />
        <Typography fontFamily="baloo2" size="xl" fontWeight="semibold">
          {title}
        </Typography>
        {description && <Typography>{description}</Typography>}
        <Button label={actionLabel} onClick={onAction} />
      </Column>
    </Column>
  );
}
