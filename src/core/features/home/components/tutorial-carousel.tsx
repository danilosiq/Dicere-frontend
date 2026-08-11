import { Carousel } from "@/core/components/carousel";
import { Column } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import LangChangeImage from "@/core/assets/images/homeCarousel/lang-change.png";
import MicAndHeadPhones from "@/core/assets/images/homeCarousel/mic-and-headphones.png";
import PlusAndPasswordImage from "@/core/assets/images/homeCarousel/plus-and-password.png";
import SaluiGuyImage from "@/core/assets/images/homeCarousel/salui-guy.png";
import Image from "next/image";

export function TutorialCarousel() {
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
            Crie
          </Typography>
          {" uma sala, ou "}
          <Typography
            color="primary-purple"
            darkColor="light-purple"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            coloque a senha
          </Typography>
          {" para entrar em uma via Link"}
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
            Configure o idioma
          </Typography>
          {" que será traduzido"}
        </>
      ),
      image: LangChangeImage,
    },
    {
      label: (
        <>
          Não esqueça de configurar seu{" "}
          <Typography
            color="primary-green"
            darkColor="light-green"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            audio
          </Typography>
          {" e "}
          <Typography
            color="primary-purple"
            darkColor="light-purple"
            fontFamily="baloo2"
            fontWeight="semibold"
            size="xl"
          >
            som
          </Typography>
          !
        </>
      ),
      image: MicAndHeadPhones,
    },
    {
      label: "Aproveite a chamada!",
      image: SaluiGuyImage,
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
