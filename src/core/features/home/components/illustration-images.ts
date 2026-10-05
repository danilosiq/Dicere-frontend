import type { StaticImageData } from "next/image";
import type { SiteLocale } from "@/core/i18n/locales";

import heroPt from "@/core/assets/images/dicere-photo-1.png";
import heroEn from "@/core/assets/images/localized/dicere-photo-1-en.png";
import heroEs from "@/core/assets/images/localized/dicere-photo-1-es.png";
import heroZh from "@/core/assets/images/localized/dicere-photo-1-zh-CN.png";
import greetingPt from "@/core/assets/images/homeCarousel/salui-guy.png";
import greetingEn from "@/core/assets/images/localized/salui-guy-en.png";
import greetingEs from "@/core/assets/images/localized/salui-guy-es.png";
import greetingZh from "@/core/assets/images/localized/salui-guy-zh-CN.png";

export const heroImages: Record<SiteLocale, StaticImageData> = {
  "pt-BR": heroPt,
  en: heroEn,
  es: heroEs,
  "zh-CN": heroZh,
};

export const greetingImages: Record<SiteLocale, StaticImageData> = {
  "pt-BR": greetingPt,
  en: greetingEn,
  es: greetingEs,
  "zh-CN": greetingZh,
};
