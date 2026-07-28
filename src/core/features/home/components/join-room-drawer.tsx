import { Drawer } from "@/core/components/drawer";
import { Column } from "@/core/components/layout";
import { JoinRoomForm } from "@/core/forms";
import type { JoinRoomSchemaType } from "@/core/forms/join-room-form/schema";
import { Typography } from "@/core/components/typography";
import PasswordImage from "@/images/password-image.png";
import Image from "next/image";
import type { DeepLTargetLanguage } from "@/core/components";

interface JoinRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: JoinRoomSchemaType) => void | Promise<void>;
  initialRoomCode?: string;
  initialName?: string;
  initialTargetLanguage?: DeepLTargetLanguage;
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
  resumeOnly,
  errorMessage,
}: JoinRoomDrawerProps) {
  return (
    <Drawer
      title={resumeOnly ? "Retomar sala" : "Entrar em uma sala"}
      open={isOpen}
      onClose={onClose}
      enableCloseButton
    >
      <Column className="w-full items-center gap-10">
        <Image src={PasswordImage} alt="password" width={200} height={200} />

        {resumeOnly && (
          <Typography className="text-center" size="sm">
            Entre novamente como {initialName} na sala {initialRoomCode}.
          </Typography>
        )}

        {errorMessage && (
          <div
            className="border-error bg-error-light text-error-dark w-full rounded-lg border p-3"
            role="alert"
          >
            <Typography color="error" darkColor="error" size="sm">
              {errorMessage}
            </Typography>
          </div>
        )}

        <JoinRoomForm
          initialName={initialName}
          initialRoomCode={initialRoomCode}
          initialTargetLanguage={initialTargetLanguage}
          onCancel={onClose}
          onSubmit={onSubmit}
          resumeOnly={resumeOnly}
        />
      </Column>
    </Drawer>
  );
}
