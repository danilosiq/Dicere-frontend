"use client";

import { useRouter } from "next/navigation";
import { StatusScreen } from "@/core/components/status-screen";
import { useSiteLanguage } from "@/core/i18n/provider";

export default function NotFound() {
  const { t } = useSiteLanguage();
  const router = useRouter();
  return (
    <StatusScreen
      title={t("Página não encontrada")}
      description={t("Esta página não existe ou não está mais disponível.")}
      actionLabel={t("Voltar ao início")}
      onAction={() => router.replace("/")}
    />
  );
}
