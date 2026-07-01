import type { Metadata } from "next";
import { Baloo_2, Roboto } from "next/font/google";
import type { PropsWithChildren } from "react";

import { Providers } from "@/app/providers";

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

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo-2",
});

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
});

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
      <body className={`${baloo.variable} ${roboto.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
