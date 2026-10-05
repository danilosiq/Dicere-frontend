"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

import { Carousel } from "@/core/components/carousel";
import { Column } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import LangChangeImage from "@/core/assets/images/homeCarousel/lang-change.png";
import MicAndHeadPhones from "@/core/assets/images/homeCarousel/mic-and-headphones.png";
import PlusAndPasswordImage from "@/core/assets/images/homeCarousel/plus-and-password.png";
import Image from "next/image";
import { greetingImages } from "./illustration-images";

export function TutorialCarousel() {
  const { locale, t } = useSiteLanguage();
  const carouselItems = [
    {
      label: (
        <>
          <Typography
            color="primary-green"
            darkColor="light-green"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            {t("Crie")}
          </Typography>
          {t(" uma sala, ou ")}
          <Typography
            color="primary-purple"
            darkColor="light-purple"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            {t("coloque a senha")}
          </Typography>
          {t(" para entrar em uma via Link")}
        </>
      ),
      image: PlusAndPasswordImage,
    },
    {
      label: (
        <>
          <Typography
            color="primary-green"
            darkColor="light-green"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            {t("Configure o idioma")}
          </Typography>
          {t(" que será traduzido")}
        </>
      ),
      image: LangChangeImage,
    },
    {
      label: (
        <>
          {t("Não esqueça de configurar seu")}{" "}
          <Typography
            color="primary-green"
            darkColor="light-green"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            {t("audio")}
          </Typography>
          {t(" e ")}
          <Typography
            color="primary-purple"
            darkColor="light-purple"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            {t("som")}
          </Typography>
          !
        </>
      ),
      image: MicAndHeadPhones,
    },
    {
      label: t("Aproveite a chamada!"),
      image: greetingImages[locale],
    },
  ];

  return (
    <Carousel>
      {carouselItems.map((item, index) => (
        <Column
          className="items-center justify-center gap-3 text-center"
          key={index}
        >
          <Image
            alt=""
            className="block size-75 object-contain select-none"
            draggable={false}
            priority
            width={300}
            height={300}
            quality={100}
            src={item.image}
          />
          <Typography
            fontFamily="baloo2"
            size={"xl"}
            fontWeight="semibold"
            className="text-center"
          >
            {item.label}
          </Typography>
        </Column>
      ))}
    </Carousel>
  );
}
