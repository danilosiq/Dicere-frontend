"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Carousel as ShadcnCarousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { IconButton } from "@/core/components/icon-button";
import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import { cn } from "@/core/utils/cn";

export type CarouselProps = {
  children: ReactNode;
  showIndicators?: boolean;
  className?: string;
  contentClassName?: string;
};

export function Carousel({
  children,
  showIndicators = false,
  className,
  contentClassName,
}: CarouselProps) {
  const slides = Children.toArray(children);
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(slides.length > 0 ? 1 : 0);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateCarouselState = useCallback(
    (carouselApi: NonNullable<CarouselApi>) => {
      setCurrentSlide(
        slides.length > 0 ? carouselApi.selectedScrollSnap() + 1 : 0,
      );
      setCanScrollPrevious(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
    },
    [slides.length],
  );

  useEffect(() => {
    if (!api) return;

    const animationFrame = window.requestAnimationFrame(() =>
      updateCarouselState(api),
    );
    api.on("select", updateCarouselState);
    api.on("reInit", updateCarouselState);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      api.off("select", updateCarouselState);
      api.off("reInit", updateCarouselState);
    };
  }, [api, updateCarouselState]);

  return (
    <Column className={cn("w-full gap-3", className)}>
      <Row className="w-full items-center gap-3">
        <IconButton
          ariaLabel="Slide anterior"
          className="hover:bg-primary-purple dark:hover:bg-primary-purple shrink-0 text-gray-900 hover:text-white dark:text-gray-100 dark:hover:text-white"
          disabled={!canScrollPrevious}
          icon={<ChevronLeft />}
          onClick={() => api?.scrollPrev()}
        />

        <ShadcnCarousel className="min-w-0 flex-1" setApi={setApi}>
          <CarouselContent className={contentClassName}>
            {slides.map((slide, index) => (
              <CarouselItem
                aria-label={`${index + 1} de ${slides.length}`}
                key={index}
              >
                {slide}
              </CarouselItem>
            ))}
          </CarouselContent>
        </ShadcnCarousel>

        <IconButton
          ariaLabel="Próximo slide"
          className="hover:bg-primary-purple dark:hover:bg-primary-purple shrink-0 text-gray-900 hover:text-white dark:text-gray-100 dark:hover:text-white"
          disabled={!canScrollNext}
          icon={<ChevronRight />}
          onClick={() => api?.scrollNext()}
        />
      </Row>

      {showIndicators ? (
        <span
          aria-label={`Slide ${currentSlide} de ${slides.length}`}
          aria-live="polite"
          className="self-center"
          role="status"
        >
          <Typography className="text-gray-900 dark:text-gray-100" size="sm">
            {currentSlide} / {slides.length}
          </Typography>
        </span>
      ) : null}
    </Column>
  );
}
