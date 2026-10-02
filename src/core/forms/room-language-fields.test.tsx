import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CreateRoomForm, JoinRoomForm } from "./index";
vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "" }),
  Roboto: () => ({ className: "" }),
}));
const target = "Idioma que deseja receber as traduções";
const spoken = "Idioma que você irá falar na chamada";
function select(label: string, name: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(name + "$") }));
}
describe("two room languages", () => {
  it.each(["create", "join"])(
    "submits independent languages from %s",
    async (kind) => {
      const onSubmit = vi.fn();
      render(
        kind === "create" ? (
          <CreateRoomForm onSubmit={onSubmit} />
        ) : (
          <JoinRoomForm onSubmit={onSubmit} />
        ),
      );
      if (kind === "create")
        fireEvent.change(screen.getByLabelText(/Título da sala/), {
          target: { value: "Daily" },
        });
      else
        fireEvent.change(screen.getByLabelText(/Código da sala/), {
          target: { value: "ABC-234-K9X" },
        });
      fireEvent.change(screen.getByLabelText(/Seu nome/), {
        target: { value: "Maria" },
      });
      fireEvent.change(screen.getByLabelText(/Senha/), {
        target: { value: "secret" },
      });
      select(target, "Português");
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      await screen.findByText(
        "Selecione o idioma que você irá falar na chamada",
      );
      expect(onSubmit).not.toHaveBeenCalled();
      select(spoken, "Espanhol");
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            targetLanguage: "PT-BR",
            spokenLanguage: "ES",
          }),
        ),
      );
    },
  );
  it("restores the separate choices when resuming", () => {
    render(
      <JoinRoomForm
        initialRoomCode="ABC-234-K9X"
        initialName="Maria"
        initialSpokenLanguage="EN"
        initialTargetLanguage="ES"
        resumeOnly
      />,
    );
    expect(screen.getByRole("button", { name: target }).textContent).toContain(
      "Espanhol",
    );
    expect(screen.getByRole("button", { name: spoken }).textContent).toContain(
      "Inglês",
    );
  });
});
