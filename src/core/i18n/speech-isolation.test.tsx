import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useServerSpeech } from "@/core/hooks/use-server-speech";
import { SiteLanguageProvider, useSiteLanguage } from "./provider";
import { SITE_LOCALE_STORAGE_KEY } from "./locales";

const engine = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  created: vi.fn(),
}));
vi.mock("@/core/services/server-speech/recovery", () => ({
  RecoveringSpeechEngine: class {
    constructor(options: unknown) {
      engine.created(options);
    }
    start = engine.start;
    stop = engine.stop;
  },
}));

function Probe() {
  const { t, setLocale } = useSiteLanguage();
  useServerSpeech({ roomId: "room-1", locale: "en-US", enabled: true });
  return <button onClick={() => setLocale("zh-CN")}>{t("Confirmar")}</button>;
}

it("does not stop or restart recognition when only the site locale changes", async () => {
  localStorage.setItem(SITE_LOCALE_STORAGE_KEY, "en");
  const view = render(
    <SiteLanguageProvider>
      <Probe />
    </SiteLanguageProvider>,
  );
  await screen.findByRole("button", { name: "Confirm" });
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("button", { name: "确认" });
  expect(engine.created).toHaveBeenCalledTimes(1);
  expect(engine.created).toHaveBeenCalledWith(
    expect.objectContaining({ locale: "en-US" }),
  );
  expect(engine.start).toHaveBeenCalledTimes(1);
  expect(engine.stop).not.toHaveBeenCalled();
  view.unmount();
  expect(engine.stop).toHaveBeenCalledTimes(1);
});
