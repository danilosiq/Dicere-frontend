import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectorCountry } from "@/core/components/selector-country";

describe("SelectorCountry", () => {
  it("keeps the regular trigger label by default", () => {
    render(<SelectorCountry onSelect={vi.fn()} placeholder="Idioma falado" />);

    expect(screen.getByText("Idioma falado")).toBeTruthy();
  });

  it("uses a compact trigger while keeping labels in the open list", () => {
    const onSelect = vi.fn();
    render(
      <SelectorCountry
        hideLabelText
        onSelect={onSelect}
        placeholder="Idioma falado"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Selecionar idioma" });
    expect(screen.queryByText("Idioma falado")).toBeNull();
    expect(trigger.parentElement?.className).toContain("w-auto");
    expect(trigger.parentElement?.className).toContain("shrink-0");

    fireEvent.click(trigger);
    const option = screen.getByRole("option", { name: /PT-BR/ });
    expect(option).toBeTruthy();
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith("PT-BR");
    expect(
      screen.getByRole("button", { name: "Selecionar idioma: PT-BR" }),
    ).toBeTruthy();
    expect(screen.queryByText("PT-BR")).toBeNull();
    expect(screen.getByLabelText("Bandeira BR")).toBeTruthy();
  });

  it("opens upward when the trigger is close to the viewport bottom", () => {
    const viewportHeight = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(600);

    render(<SelectorCountry onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Selecionar idioma" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 580,
      height: 40,
      left: 0,
      right: 160,
      top: 540,
      width: 160,
      x: 0,
      y: 540,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);

    const listbox = screen.getByRole("listbox", {
      name: "Idiomas disponíveis",
    });
    expect(listbox.className).toContain("bottom-full");
    expect(listbox.className).not.toContain("top-full");
    expect(listbox.style.maxHeight).toBe("288px");

    viewportHeight.mockRestore();
  });
});
