import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Polices auto-hébergées par Next.js : aucun appel à Google au chargement des pages.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["500", "700"],
});

// URL publique : variable explicite, sinon domaine de production fourni par Vercel.
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: BRAND.name,
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  // Application installable sur l'écran d'accueil (Android, iPhone, ordinateur).
  appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: "Encaissez vos loyers à l'heure : échéances automatiques, relances, Mobile Money, quittances PDF.",
    siteName: BRAND.name,
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${mono.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
