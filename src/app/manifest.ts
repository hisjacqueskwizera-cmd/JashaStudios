import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jasha Studios",
    short_name: "Jasha",
    description: "AI-powered virtual photography studio.",
    start_url: "/",
    display: "standalone",
    background_color: "#10100f",
    theme_color: "#10100f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
