import type { MetadataRoute } from "next";

/** Makes ArthMitra installable as a PWA ("Add to Home screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArthMitra — your AI money coach",
    short_name: "ArthMitra",
    description: "Know your realistic saving, plan a Big Day or build wealth, and track it all.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b57d0",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
