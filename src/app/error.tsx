"use client";

import { StatusScreen } from "@/core/components/status-screen";
import { useSiteLanguage } from "@/core/i18n/provider";

export default function PageError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useSiteLanguage();
  return (
    <StatusScreen
      title={t("Não foi possível carregar esta página.")}
      actionLabel={t("Tentar novamente")}
      onAction={retry}
    />
  );
}
