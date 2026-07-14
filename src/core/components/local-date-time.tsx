"use client";

import { Typography } from "@/core/components/typography";
import { useLocalDateTime } from "@/core/hooks/use-local-date-time";

export type LocalDateTimeProps = {
  className?: string;
};

export function LocalDateTime({ className }: LocalDateTimeProps) {
  const { formattedDateTime } = useLocalDateTime();

  return (
    <Typography fontFamily="baloo2" className={className}>
      {formattedDateTime}
    </Typography>
  );
}
