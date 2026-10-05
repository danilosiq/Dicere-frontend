import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { SiteLanguageProvider, useSiteLanguage } from "./provider";
import { SITE_LOCALE_STORAGE_KEY } from "./locales";

function Probe() {
  const { locale, setLocale, t } = useSiteLanguage();
  return (
    <>
      <output>{locale}</output>
      <button onClick={() => setLocale("es")}>{t("Criar uma sala")}</button>
    </>
  );
}

describe("site language preference", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
  });
  it("detects the browser and updates the document language", async () => {
    render(
      <SiteLanguageProvider>
        <Probe />
      </SiteLanguageProvider>,
    );
    await screen.findByText("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button").textContent).toBe("Create a room");
  });
  it("saves a manual selection and restores it instead of the browser language", async () => {
    const view = render(
      <SiteLanguageProvider>
        <Probe />
      </SiteLanguageProvider>,
    );
    await screen.findByText("en");
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem(SITE_LOCALE_STORAGE_KEY)).toBe("es");
    view.unmount();
    render(
      <SiteLanguageProvider>
        <Probe />
      </SiteLanguageProvider>,
    );
    await screen.findByText("es");
    expect(document.documentElement.lang).toBe("es");
  });
  it("ignores corrupted storage and handles cross-tab changes", async () => {
    localStorage.setItem(SITE_LOCALE_STORAGE_KEY, "DE");
    render(
      <SiteLanguageProvider>
        <Probe />
      </SiteLanguageProvider>,
    );
    await screen.findByText("en");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SITE_LOCALE_STORAGE_KEY,
          newValue: "zh-CN",
        }),
      ),
    );
    await screen.findByText("zh-CN");
    expect(screen.getByRole("button").textContent).toBe("创建房间");
  });
  it("remains usable when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(
      <SiteLanguageProvider>
        <Probe />
      </SiteLanguageProvider>,
    );
    await screen.findByText("en");
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });
  it("renders predictable server HTML without reading browser preferences", () => {
    const html = renderToString(
      <SiteLanguageProvider>
        <Probe />
      </SiteLanguageProvider>,
    );
    expect(html).toContain("Criar uma sala");
    expect(html).toContain("pt-BR");
  });
});
