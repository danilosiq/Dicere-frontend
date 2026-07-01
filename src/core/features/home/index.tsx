import { Button } from "@/components/button";
import DicereLogo from "@/core/assets/icons/dicereLogo.svg";
import { Column } from "@/core/components/layout";
import { ThemeToggle } from "@/core/components/theme-toggle";

export function HomeScreen() {
  return (
    <Column className="bg-background text-foreground min-h-screen p-6">
      <header className="flex items-center justify-between">
        <DicereLogo aria-label="Dicere" role="img" />
        <ThemeToggle />
        <Button label="Confirmar" variant="secondary" />
      </header>
    </Column>
  );
}
