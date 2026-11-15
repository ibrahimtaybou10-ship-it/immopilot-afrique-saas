import { notFound } from "next/navigation";
import { appIcon } from "@/lib/app-icon";

const VARIANTS: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
};

// Générées une seule fois à la compilation, puis servies comme des fichiers statiques.
export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const spec = VARIANTS[variant];
  if (!spec) notFound();
  return appIcon(spec.size, spec.maskable);
}
