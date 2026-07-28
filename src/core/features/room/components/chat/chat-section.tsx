import { IconButton } from "@/core/components/icon-button";
import { InputText } from "@/core/components/input-text";
import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import chatBackgroundBlack from "@/images/chat-background-black.png";
import chatBackgroundWhite from "@/images/chat-background-white.png";
import { SendHorizonal } from "lucide-react";
import { ChatBalloon } from "./chat-balloon";

export function ChatSection() {
  return (
    <Column className="min-h-0 w-[40%]">
      <Row className="shrink-0 p-4">
        <Typography>Titulo da sala</Typography>
      </Row>
      <Column className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center dark:hidden"
          style={{ backgroundImage: `url(${chatBackgroundWhite.src})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-cover bg-center dark:block"
          style={{ backgroundImage: `url(${chatBackgroundBlack.src})` }}
        />

        <Column className="relative z-10 mt-6 min-h-0 flex-1 gap-6 px-6">
          <ChatBalloon role="sender" />
          <ChatBalloon role="receiver" />
        </Column>
        <Row className="relative z-10 shrink-0 rounded-lg p-2">
          <InputText placeholder="Escreva uma mensagem..." />
          <IconButton icon={<SendHorizonal />} />
        </Row>
      </Column>
    </Column>
  );
}
