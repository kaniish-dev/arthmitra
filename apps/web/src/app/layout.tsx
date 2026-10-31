import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Google Sans covers Latin and Devanagari, so English and Hindi share one typeface.
// next/font has no fallback metrics for it yet, so builds print a harmless "Failed to find font override values" warning.
const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["latin", "devanagari"] });

export const metadata: Metadata = {
  title: { default: "ArthMitra — Har kharch ka hisaab, har sapne ka plan", template: "%s · ArthMitra" },
  description:
    "See every payment as it happens, sorted into categories, and turn your surplus into a dated plan for one goal.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${googleSans.variable} h-full antialiased`}>
      <head>
        {/* Material Symbols (Google Fonts) for every icon. display=block stops icon names flashing as text. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
        />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
