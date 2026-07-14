import { Drawer } from "@/core/components/drawer";
import { Column } from "@/core/components/layout";
import { JoinRoomForm } from "@/core/forms";
import PasswordImage from "@/images/password-image.png";
import Image from "next/image";

interface JoinRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinRoomDrawer({ isOpen, onClose }: JoinRoomDrawerProps) {
  return (
    <Drawer
      title="Entrar em uma sala"
      open={isOpen}
      onClose={onClose}
      enableCloseButton
    >
      <Column className="w-full items-center gap-10">
        <Image src={PasswordImage} alt="password" width={200} height={200} />

        <JoinRoomForm onCancel={onClose} />
      </Column>
    </Drawer>
  );
}
