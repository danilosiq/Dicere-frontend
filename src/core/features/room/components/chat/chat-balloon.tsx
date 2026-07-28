import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import { Languages } from "lucide-react";

interface ChatBalloonProps {
  role: "sender" | "receiver";
}

export function ChatBalloon({ role }: ChatBalloonProps) {
  const senderVariant = "bg-primary-green rounded-tl-lg rounded-b-lg p-2 ";

  const receiverVariant = "bg-primary-purple rounded-tr-lg rounded-b-lg p-2 ";

  function handleRole() {
    if (role === "sender") {
      return senderVariant;
    } else {
      return receiverVariant;
    }
  }

  return (
    <Column>
      <Column className={handleRole()}>
        <Typography
          fontFamily="baloo2"
          size={"lg"}
          className={`${role === "sender" ? "text-end" : "text-start"}`}
          fontWeight="semibold"
          color="white"
        >
          Fulano de tal
        </Typography>

        <Typography color="white" size={"sm"}>
          Lorem ipsum, dolor sit amet consectetur adipisicing elit. Fugiat culpa
          nostrum molestiae rem doloremque sunt officiis ea veniam alias
          obcaecati, qui possimus temporibus aliquam illo perspiciatis quaerat
          mollitia placeat et.
        </Typography>
      </Column>
      <Row
        className={`cursor-pointer items-center gap-1 ${role === "sender" ? "text-primary-green" : "text-primary-purple"}`}
      >
        <Languages size={18} />
        <Typography size={"sm"}>Traduzir</Typography>
      </Row>
    </Column>
  );
}
