"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

import { CircleQuestionMark } from "lucide-react";
import { IconButton } from "./icon-button";
import { Row } from "./layout";
import { LocalDateTime } from "./local-date-time";
import { ThemeToggle } from "./theme-toggle";
import { SiteLanguageSelector } from "./site-language-selector";

export function Header() {
  const { t } = useSiteLanguage();
  return (
    <Row className="flex-wrap items-center justify-between gap-2">
      <Row className="flex-wrap items-center gap-3">
        <LocalDateTime />
        <SiteLanguageSelector />
      </Row>
      <Row className="gap-1">
        <ThemeToggle />
        <IconButton icon={<CircleQuestionMark />} tooltip={t("Ajuda")} />
      </Row>
    </Row>
  );
}
