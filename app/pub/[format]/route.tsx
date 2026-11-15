import { notFound } from "next/navigation";
import { AD_FORMATS, renderAd, type AdFormat } from "@/lib/ad-creative";

// Affiches publicitaires téléchargeables : /pub/carre, /pub/carre-proprietaires, /pub/story, /pub/banniere
export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(AD_FORMATS).map((format) => ({ format }));
}

const host = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "loyeo-kappa.vercel.app"))
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

export async function GET(_request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (!(format in AD_FORMATS)) notFound();
  return renderAd(format as AdFormat, host());
}
