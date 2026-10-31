import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Google Sans covers Latin and Devanagari, so English and Hindi share one typeface.
// next/font has no fallback metrics for it yet, so builds print a harmless "Failed to find font override values" warning.
const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["latin", "devanagari"] });

export const metadata: Metadata = {
  title: { default: "ArthMitra — your AI money coach", template: "%s · ArthMitra" },
  description:
    "An AI money coach for Gen Z in India: a realistic monthly saving from your past spends, a plan for a Big Day or long-term wealth, and portfolio tracking.",
  appleWebApp: { capable: true, title: "ArthMitra", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b57d0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, password managers) add attributes to
    // <html>/<body> before React hydrates. It applies to these two elements only, not their children.
    <html lang="en" className={`${googleSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Material Symbols (Google Fonts) for every icon. display=block stops icon names flashing as text. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
