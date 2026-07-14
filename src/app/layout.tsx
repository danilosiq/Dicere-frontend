import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { Providers } from "@/app/providers";
import { baloo2, roboto } from "@/core/styles/fonts";

import "../core/styles/globals.css";

const themeScript = `
  try {
    const savedTheme = localStorage.getItem("dicere-theme");
    const theme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch {}
`;

export const metadata: Metadata = {
  title: {
    default: "Dicere",
    template: "%s | Dicere",
  },
  description: "Comunicação simples, direta e acessível.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${baloo2.variable} ${roboto.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
