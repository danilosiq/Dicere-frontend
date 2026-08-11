"use client";
import { Button } from "@/core/components/button";
import { Header } from "@/core/components/header";
import { Column, Row } from "@/core/components/layout";
import { Logo } from "@/core/components/logo";
import { Typography } from "@/core/components/typography";
import { HeroIllustration } from "@/core/features/home/components/hero-illustration";
import { isRoomCodeValid } from "@/core/@types/room";
import type { CreateRoomSchemaType } from "@/core/forms/create-room-form/schema";
import type { JoinRoomSchemaType } from "@/core/forms/join-room-form/schema";
import { useRoomAccess } from "@/core/hooks/use-room-access";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { CirclePlus, CornerDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateRoomDrawer } from "./components/create-room-drawer";
import { JoinRoomDrawer } from "./components/join-room-drawer";
import { TutorialCarousel } from "./components/tutorial-carousel";
import { isDeepLTargetLanguage } from "@/core/components/selector-country/countryList";

export function HomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomAccess = useRoomAccess();
  const hydrateRoomSession = useRoomSessionStore((state) => state.hydrate);
  const resumeSession = useRoomSessionStore((state) => state.resumeSession);
  const [isCreateRoomDrawerOpen, setIsCreateRoomDrawerOpen] = useState(false);
  const [isJoinRoomDrawerRequested, setIsJoinRoomDrawerRequested] =
    useState(false);
  const queryRoomCode = (searchParams.get("roomCode") ?? "")
    .trim()
    .toUpperCase();
  const initialRoomCode = isRoomCodeValid(queryRoomCode) ? queryRoomCode : "";
  const isJoinRoomDrawerOpen =
    isJoinRoomDrawerRequested || Boolean(initialRoomCode);

  useEffect(() => {
    hydrateRoomSession();
  }, [hydrateRoomSession]);

  const isResuming =
    Boolean(initialRoomCode) && resumeSession?.roomCode === initialRoomCode;

  async function handleCreateRoom(data: CreateRoomSchemaType) {
    const joinedRoom = await roomAccess.createAndEnterRoom(data);
    setIsCreateRoomDrawerOpen(false);
    router.push(`/room/${joinedRoom.room.code}`);
  }

  async function handleJoinRoom(data: JoinRoomSchemaType) {
    const joinedRoom = await roomAccess.joinExistingRoom(
      data,
      isResuming ? resumeSession?.participantId : undefined,
    );
    setIsJoinRoomDrawerRequested(false);
    router.push(`/room/${joinedRoom.room.code}`);
  }

  function openCreateRoomDrawer() {
    roomAccess.clearError();
    setIsCreateRoomDrawerOpen(true);
  }

  function closeCreateRoomDrawer() {
    roomAccess.resetCreateFlow();
    setIsCreateRoomDrawerOpen(false);
  }

  function openJoinRoomDrawer() {
    roomAccess.clearError();
    setIsJoinRoomDrawerRequested(true);
  }

  function closeJoinRoomDrawer() {
    roomAccess.clearError();
    setIsJoinRoomDrawerRequested(false);
    router.replace("/");
  }

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
              onClick={openCreateRoomDrawer}
              startIcon={<CirclePlus />}
            />
            <Button
              label="Entrar na sala"
              variant="secondary"
              startIcon={<CornerDownRight />}
              onClick={openJoinRoomDrawer}
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
        errorMessage={isCreateRoomDrawerOpen ? roomAccess.errorMessage : null}
        onClose={closeCreateRoomDrawer}
        onSubmit={handleCreateRoom}
      />
      <JoinRoomDrawer
        isOpen={isJoinRoomDrawerOpen}
        errorMessage={isJoinRoomDrawerOpen ? roomAccess.errorMessage : null}
        initialName={isResuming ? resumeSession?.nickname : undefined}
        initialRoomCode={initialRoomCode || undefined}
        initialTargetLanguage={
          isResuming && isDeepLTargetLanguage(resumeSession?.targetLanguage)
            ? resumeSession.targetLanguage
            : undefined
        }
        onClose={closeJoinRoomDrawer}
        onSubmit={handleJoinRoom}
        resumeOnly={isResuming}
      />
    </Column>
  );
}
