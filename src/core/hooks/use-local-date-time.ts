"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { enUS, es, ptBR, zhCN } from "date-fns/locale";
import { useSiteLanguage } from "@/core/i18n/provider";
import type { SiteLocale } from "@/core/i18n/locales";

const DATE_LOCALES = { "pt-BR": ptBR, en: enUS, es, "zh-CN": zhCN };
const UPDATE_INTERVAL_MS = 60_000;

export type LocalDateTime = {
  time: string;
  weekDay: string;
  day: string;
  month: string;
  formattedDateTime: string;
};

const EMPTY_LOCAL_DATE_TIME: LocalDateTime = {
  time: "",
  weekDay: "",
  day: "",
  month: "",
  formattedDateTime: "",
};

export function formatLocalDateTime(
  date: Date,
  siteLocale: SiteLocale = "pt-BR",
): LocalDateTime {
  const options = { locale: DATE_LOCALES[siteLocale] };
  const time = format(date, "HH:mm", options);
  const weekDay = format(
    date,
    siteLocale === "pt-BR" ? "EEEEEE" : "EEE",
    options,
  ).replaceAll(".", "");
  const day = format(date, "d", options);
  const month = format(date, "MMM", options).replaceAll(".", "");
  const datePattern =
    siteLocale === "pt-BR"
      ? "d 'de' MMM"
      : siteLocale === "zh-CN"
        ? "M月d日"
        : "d MMM";
  return {
    time,
    weekDay,
    day,
    month,
    formattedDateTime: `${time} • ${weekDay} - ${format(date, datePattern, options).replaceAll(".", "")}`,
  };
}

export function useLocalDateTime(): LocalDateTime {
  const { locale } = useSiteLanguage();
  const [date, setDate] = useState<Date | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDate(new Date()));
    const interval = window.setInterval(
      () => setDate(new Date()),
      UPDATE_INTERVAL_MS,
    );
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, []);
  return date ? formatLocalDateTime(date, locale) : EMPTY_LOCAL_DATE_TIME;
}
