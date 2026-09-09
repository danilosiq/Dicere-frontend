"use client";

import { Button } from "@/core/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconButton } from "@/core/components/icon-button";
import { Row } from "@/core/components/layout";
import { Logo } from "@/core/components/logo";
import { ThemeToggle } from "@/core/components/theme-toggle";
import { cn } from "@/core/utils/cn";
import {
  Check,
  Copy,
  LoaderCircle,
  Mic,
  MicOff,
  Phone,
  Settings,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

export type CopyInviteStatus = "idle" | "copying" | "success" | "error";

export interface CallToolsProps {
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  hasMicrophone?: boolean;
  hasCamera?: boolean;
  isLeaving?: boolean;
  copyInviteStatus?: CopyInviteStatus;
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
  copyInviteStatus = "idle",
  onMute,
  onToggleVideo,
  onLeave,
  onCopyInviteLink,
  onOpenParticipants,
  onOpenSettings,
}: CallToolsProps) {
  const copyLabel = {
    idle: "Compartilhar",
    copying: "Copiando...",
    success: "Copiado!",
    error: "Não foi possível copiar",
  }[copyInviteStatus];
  const copyIcon =
    copyInviteStatus === "success" ? (
      <Check />
    ) : copyInviteStatus === "copying" ? (
      <LoaderCircle className="animate-spin" />
    ) : (
      <Copy />
    );

  return (
    <footer className="border-border bg-component border-t p-6 sm:px-6">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="hidden justify-self-start sm:block">
          <Logo />
        </div>

        <Row className="items-center justify-center gap-2 sm:col-start-2">
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

        <Row className="min-w-0 items-center justify-end gap-1 justify-self-center sm:gap-2 sm:justify-self-end">
          <TooltipProvider>
            <Tooltip
              open={
                copyInviteStatus === "success" || copyInviteStatus === "error"
              }
            >
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    label="Compartilhar"
                    endIcon={copyIcon}
                    disabled={copyInviteStatus === "copying"}
                    onClick={onCopyInviteLink}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{copyLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span role="status" aria-live="polite" className="sr-only">
            {copyInviteStatus !== "idle" ? copyLabel : ""}
          </span>

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
