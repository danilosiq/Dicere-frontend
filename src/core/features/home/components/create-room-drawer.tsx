import { Drawer } from "@/core/components/drawer";
import { Column } from "@/core/components/layout";
import { CreateRoomForm } from "@/core/forms";
import PlusImage from "@/images/plus-image.png";
import Image from "next/image";

interface CreateRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRoomDrawer({ isOpen, onClose }: CreateRoomDrawerProps) {
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

        <CreateRoomForm onCancel={onClose} />
      </Column>
    </Drawer>
  );
}
