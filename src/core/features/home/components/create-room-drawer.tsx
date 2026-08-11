import { Drawer } from "@/core/components/drawer";
import { Column } from "@/core/components/layout";
import { CreateRoomForm } from "@/core/forms";
import type { CreateRoomSchemaType } from "@/core/forms/create-room-form/schema";
import { Typography } from "@/core/components/typography";
import PlusImage from "@/images/plus-image.png";
import Image from "next/image";

interface CreateRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRoomSchemaType) => void | Promise<void>;
  errorMessage?: string | null;
}

export function CreateRoomDrawer({
  isOpen,
  onClose,
  onSubmit,
  errorMessage,
}: CreateRoomDrawerProps) {
  return (
    <Drawer
      title="Criar uma sala"
      open={isOpen}
      onClose={onClose}
      enableCloseButton
    >
      <Column className="w-full items-center gap-10">
        <Image
          src={PlusImage}
          alt="plus"
          width={150}
          height={150}
          className="rotate-[-40deg]"
        />

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

        <CreateRoomForm onCancel={onClose} onSubmit={onSubmit} />
      </Column>
    </Drawer>
  );
}
