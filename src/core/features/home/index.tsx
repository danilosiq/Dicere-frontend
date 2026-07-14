"use client";
import { Button } from "@/core/components/button";
import { Header } from "@/core/components/header";
import { Column, Row } from "@/core/components/layout";
import { Logo } from "@/core/components/logo";
import { Typography } from "@/core/components/typography";
import { HeroIllustration } from "@/core/features/home/components/hero-illustration";
import { CirclePlus, CornerDownRight } from "lucide-react";
import { useState } from "react";
import { CreateRoomDrawer } from "./components/create-room-drawer";
import { JoinRoomDrawer } from "./components/join-room-drawer";
import { TutorialCarousel } from "./components/tutorial-carousel";

export function HomeScreen() {
  const [isCreateRoomDrawerOpen, setIsCreateRoomDrawerOpen] = useState(false);
  const [isJoinRoomDrawerOpen, setIsJoinRoomDrawerOpen] = useState(false);

  return (
    <Column className="bg-background text-foreground min-h-screen overflow-x-hidden p-6">
      <Header />
      <Row className="flex-col items-center justify-between gap-10 lg:flex-row">
        <Column className="mt-15 gap-8 lg:ml-5 lg:max-w-160 lg:shrink-0">
          <Logo size="xl" />
          <Typography>
            Entenda qualquer conversa, o idioma não precisa <br /> mais ser uma
            barreira
          </Typography>
          <Typography>
            Conecte-se ou crie uma sala para acessar esta experiencia
          </Typography>
          <Row className="gap-5">
            <Button
              paddingY={8}
              label="Criar uma sala"
              onClick={() => setIsCreateRoomDrawerOpen(true)}
              startIcon={<CirclePlus />}
            />
            <Button
              label="Entrar na sala"
              variant="secondary"
              startIcon={<CornerDownRight />}
              onClick={() => setIsJoinRoomDrawerOpen(true)}
            />
          </Row>
        </Column>
        <HeroIllustration />
      </Row>
      <Column className="m-auto mt-12 w-full lg:w-[40%]">
        <TutorialCarousel />
      </Column>

      <Typography className="m-auto mt-70" fontFamily="baloo2">
        Saiba mais sobre o{" "}
        <Typography
          fontFamily="baloo2"
          fontWeight="medium"
          color="primary-green"
          darkColor="light-green"
        >
          Dicere
        </Typography>
      </Typography>
      <CreateRoomDrawer
        isOpen={isCreateRoomDrawerOpen}
        onClose={() => setIsCreateRoomDrawerOpen(false)}
      />
      <JoinRoomDrawer
        isOpen={isJoinRoomDrawerOpen}
        onClose={() => setIsJoinRoomDrawerOpen(false)}
      />
    </Column>
  );
}
