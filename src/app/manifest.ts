import type { MetadataRoute } from "next";

// Makes mso-pm installable: home screen on phones, its own window on desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "mso-pm",
    short_name: "mso-pm",
    description: "Projects, tasks, issues, releases and team chat across your organizations.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f6f4",
    theme_color: "#2d55c8",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
