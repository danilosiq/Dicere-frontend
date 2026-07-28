"use client";

import { Button } from "@/core/components/button";
import { IconButton } from "@/core/components/icon-button";
import { Row } from "@/core/components/layout";
import { Logo } from "@/core/components/logo";
import { ThemeToggle } from "@/core/components/theme-toggle";
import { cn } from "@/core/utils/cn";
import {
  Copy,
  Mic,
  MicOff,
  Phone,
  Settings,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

export interface CallToolsProps {
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  hasMicrophone?: boolean;
  hasCamera?: boolean;
  isLeaving?: boolean;
  callCode: string;
  onMute?: () => void;
  onToggleVideo?: () => void;
  onLeave?: () => void;
  onCopyInviteLink?: () => void;
  onOpenParticipants?: () => void;
  onOpenSettings?: () => void;
}

const mediaButtonClasses =
  "size-11 bg-gray-100 text-gray-900 hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-900/80";

export function CallTools({
  isMuted = false,
  isVideoEnabled = true,
  hasMicrophone = true,
  hasCamera = true,
  isLeaving = false,
  onMute,
  onToggleVideo,
  onLeave,
  callCode,
  onCopyInviteLink,
  onOpenParticipants,
  onOpenSettings,
}: CallToolsProps) {
  return (
    <footer className="border-border bg-component border-t p-6 sm:px-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="hidden justify-self-start sm:block">
          <Logo />
        </div>

        <Row className="col-start-2 items-center justify-center gap-2">
          <IconButton
            ariaLabel={isMuted ? "Ativar microfone" : "Desativar microfone"}
            className={cn(
              mediaButtonClasses,
              isMuted &&
                "bg-primary-purple hover:bg-primary-purple/90 dark:bg-primary-purple dark:hover:bg-primary-purple/90 text-white hover:text-white",
            )}
            icon={isMuted ? <MicOff /> : <Mic />}
            isActive={isMuted}
            disabled={!hasMicrophone || isLeaving}
            onClick={onMute}
            tooltip={isMuted ? "Ativar microfone" : "Desativar microfone"}
          />

          <IconButton
            ariaLabel={isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}
            className={cn(
              mediaButtonClasses,
              !isVideoEnabled &&
                "bg-primary-purple hover:bg-primary-purple/90 dark:bg-primary-purple dark:hover:bg-primary-purple/90 text-white hover:text-white",
            )}
            icon={isVideoEnabled ? <Video /> : <VideoOff />}
            isActive={!isVideoEnabled}
            disabled={!hasCamera || isLeaving}
            onClick={onToggleVideo}
            tooltip={isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}
          />

          <IconButton
            ariaLabel="Sair da chamada"
            className="bg-error hover:bg-error/90 h-11 w-16 rounded-full text-white hover:text-white"
            icon={<Phone className="rotate-135" />}
            disabled={isLeaving}
            onClick={onLeave}
            tooltip="Sair da chamada"
          />
        </Row>

        <Row className="min-w-0 items-center justify-end gap-1 justify-self-end sm:gap-2">
          <Button label={callCode} endIcon={<Copy />} />

          <IconButton
            ariaLabel="Copiar link de convite"
            className="sm:hidden"
            icon={<Copy />}
            onClick={onCopyInviteLink}
            tooltip="Copiar link de convite"
          />

          <ThemeToggle />

          <IconButton
            ariaLabel="Ver participantes"
            className="hidden sm:inline-flex"
            icon={<Users />}
            onClick={onOpenParticipants}
            tooltip="Participantes"
          />

          <IconButton
            ariaLabel="Abrir configurações"
            className="hidden sm:inline-flex"
            icon={<Settings />}
            onClick={onOpenSettings}
            tooltip="Configurações"
          />
        </Row>
      </div>
    </footer>
  );
}
