"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

import { Drawer } from "@/core/components/drawer";
import { Column } from "@/core/components/layout";
import { JoinRoomForm } from "@/core/forms";
import type { JoinRoomSchemaType } from "@/core/forms/join-room-form/schema";
import { Typography } from "@/core/components/typography";
import PasswordImage from "@/core/assets/images/password-image.png";
import Image from "next/image";
import type { DeepLTargetLanguage } from "@/core/components";

interface JoinRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: JoinRoomSchemaType) => void | Promise<void>;
  initialRoomCode?: string;
  initialName?: string;
  initialTargetLanguage?: DeepLTargetLanguage;
  initialSpokenLanguage?: DeepLTargetLanguage;
  resumeOnly?: boolean;
  errorMessage?: string | null;
}

export function JoinRoomDrawer({
  isOpen,
  onClose,
  onSubmit,
  initialRoomCode,
  initialName,
  initialTargetLanguage,
  initialSpokenLanguage,
  resumeOnly,
  errorMessage,
}: JoinRoomDrawerProps) {
  const { t, feedback } = useSiteLanguage();
  return (
    <Drawer
      title={resumeOnly ? t("Retomar sala") : t("Entrar em uma sala")}
      open={isOpen}
      onClose={onClose}
      enableCloseButton
    >
      <Column className="w-full items-center gap-10">
        <Image src={PasswordImage} alt="" width={200} height={200} />

        {resumeOnly && (
          <Typography className="text-center" size="sm">
            {t("Entre novamente como {name} na sala {code}.", {
              name: initialName ?? "",
              code: initialRoomCode ?? "",
            })}
          </Typography>
        )}

        {errorMessage && (
          <div
            className="border-error bg-error-light text-error-dark w-full rounded-lg border p-3"
            role="alert"
          >
            <Typography color="error" darkColor="error" size="sm">
              {feedback(errorMessage)}
            </Typography>
          </div>
        )}

        <JoinRoomForm
          initialName={initialName}
          initialRoomCode={initialRoomCode}
          initialTargetLanguage={initialTargetLanguage}
          initialSpokenLanguage={initialSpokenLanguage}
          onCancel={onClose}
          onSubmit={onSubmit}
          resumeOnly={resumeOnly}
        />
      </Column>
    </Drawer>
  );
}
