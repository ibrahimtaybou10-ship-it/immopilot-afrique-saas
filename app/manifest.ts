import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Manifeste d'application web : rend le site installable comme une application mobile. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.shortName,
    description: BRAND.description,
    lang: "fr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: BRAND.themeColor,
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Collecte des loyers", short_name: "Loyers", url: "/dashboard/rent-roll" },
      { name: "Locataires & baux", short_name: "Locataires", url: "/dashboard/tenants" },
      { name: "Biens", url: "/dashboard/properties" },
    ],
  };
}
