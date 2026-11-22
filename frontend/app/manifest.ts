import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daymark — Daily habits",
    short_name: "Daymark",
    description: "Build a steady, everyday habit practice with Daymark.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#2f7654",
    icons: [
      {
        src: "/daymark-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
