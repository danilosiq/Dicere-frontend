import Image, { type StaticImageData } from "next/image";

import balloonImage from "@/core/assets/images/baloon.png";
import baseImage from "@/core/assets/images/dicere-photo-1.png";
import lampImage from "@/core/assets/images/lamp.png";
import sparklesImage from "@/core/assets/images/sparkles.png";
import { cn } from "@/core/utils/cn";

interface IllustrationLayer {
  animationClassName?: string;
  image: StaticImageData;
  layerClassName: string;
  name: string;
  positionClassName: string;
}

// Keep static positioning on the outer wrapper and animate only the inner one.
const illustrationLayers: IllustrationLayer[] = [
  {
    animationClassName:
      "animate-hero-float will-change-transform [animation-delay:-1s] [animation-duration:7.5s] motion-reduce:animate-none motion-reduce:will-change-auto",
    image: balloonImage,
    layerClassName: "hero-illustration__balloon",
    name: "balloon",
    positionClassName: "absolute top-[40.8%] left-[1.52%] z-10 w-[13.71%]",
  },
  {
    image: baseImage,
    layerClassName: "hero-illustration__base",
    name: "base",
    positionClassName: "absolute top-[5.17%] left-[16.7%] z-20 w-[71.62%]",
  },
  {
    animationClassName:
      "animate-hero-float will-change-transform [animation-delay:-1s] [animation-duration:6.8s] motion-reduce:animate-none motion-reduce:will-change-auto",
    image: sparklesImage,
    layerClassName: "hero-illustration__sparkles",
    name: "sparkles",
    positionClassName: "absolute top-[19.25%] left-[18.67%] z-30 w-[16.57%]",
  },
  {
    animationClassName:
      "animate-hero-float will-change-transform [animation-delay:-1s] [animation-duration:8.2s] motion-reduce:animate-none motion-reduce:will-change-auto",
    image: lampImage,
    layerClassName: "hero-illustration__lamp",
    name: "lamp",
    positionClassName: "absolute top-[44.25%] left-[80.76%] z-30 w-[15.81%]",
  },
];

function IllustrationLayer({
  animationClassName,
  image,
  layerClassName,
  name,
  positionClassName,
}: IllustrationLayer) {
  return (
    <span className={positionClassName} data-illustration-layer={name}>
      <span className={cn("block", layerClassName, animationClassName)}>
        <Image
          alt=""
          className="block h-auto w-full select-none"
          draggable={false}
          priority
          quality={100}
          src={image}
          sizes="(min-width: 1536px) 960px, (max-width: 769px) 100vw, 769px"
        />
      </span>
    </span>
  );
}

export function HeroIllustration() {
  return (
    <figure
      aria-hidden="true"
      className="relative aspect-525/348 w-full max-w-192.25 min-w-0 overflow-visible 2xl:max-w-240"
    >
      {illustrationLayers.map((layer) => (
        <IllustrationLayer key={layer.name} {...layer} />
      ))}
    </figure>
  );
}
