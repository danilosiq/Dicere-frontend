import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImgHTMLAttributes, PropsWithChildren } from "react";
import type { StaticImageData } from "next/image";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteLanguageProvider, useSiteLanguage } from "./provider";
import type { SiteLocale } from "./locales";
import { HeroIllustration } from "@/core/features/home/components/hero-illustration";
import { TutorialCarousel } from "@/core/features/home/components/tutorial-carousel";

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "" }),
  Roboto: () => ({ className: "" }),
}));
vi.mock("@/core/components/carousel", () => ({
  Carousel: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
  }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    src: string | StaticImageData;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Test double for the production Next Image component.
    <img src={typeof src === "string" ? src : src.src} alt={alt} />
  ),
}));

function SwitchLanguage() {
  const { setLocale } = useSiteLanguage();
  return <button onClick={() => setLocale("zh-CN")}>ZH</button>;
}

describe("localized illustration assets", () => {
  beforeEach(() => localStorage.clear());

  it.each<SiteLocale>(["pt-BR", "en", "es", "zh-CN"])(
    "uses %s artwork and changes it with the interface language",
    async (locale) => {
      vi.spyOn(navigator, "languages", "get").mockReturnValue([locale]);
      const { container } = render(
        <SiteLanguageProvider>
          <HeroIllustration />
          <TutorialCarousel />
          <SwitchLanguage />
        </SiteLanguageProvider>,
      );
      const suffix = locale === "pt-BR" ? "" : `-${locale}`;
      const hero = container.querySelector(
        '[data-illustration-layer="base"] img',
      );
      await waitFor(() =>
        expect(hero?.getAttribute("src")).toContain(
          `dicere-photo-1${suffix}.png`,
        ),
      );
      expect(
        container.querySelector(`img[src*="salui-guy${suffix}.png"]`),
      ).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /^ZH$/ }));
      await waitFor(() =>
        expect(hero?.getAttribute("src")).toContain("dicere-photo-1-zh-CN.png"),
      );
      expect(
        container.querySelector('img[src*="salui-guy-zh-CN.png"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-illustration-layer="balloon"] img'),
      ).not.toBeNull();
    },
  );
});
