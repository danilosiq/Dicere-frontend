import { CircleQuestionMark } from "lucide-react";
import { IconButton } from "./icon-button";
import { Row } from "./layout";
import { LocalDateTime } from "./local-date-time";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <Row className="items-center justify-between">
      <LocalDateTime />
      <Row className="gap-1">
        <ThemeToggle />
        <IconButton icon={<CircleQuestionMark />} tooltip="Ajuda" />
      </Row>
    </Row>
  );
}
