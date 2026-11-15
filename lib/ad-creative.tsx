import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "./brand";

// Police Inter (licence SIL Open Font), incluse dans le dépôt : rendu identique partout.
const fonts = () =>
  Promise.all([
    readFile(join(process.cwd(), "assets/fonts/inter-500.ttf")),
    readFile(join(process.cwd(), "assets/fonts/inter-800.ttf")),
  ]).then(([regular, bold]) => [
    { name: "Inter", data: regular, weight: 500 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 800 as const, style: "normal" as const },
  ]);

/**
 * Affiches publicitaires générées en PNG (formats des réseaux sociaux).
 * Texte net et exact, modifiable ici : aucune génération d'image payante.
 */
export const AD_FORMATS = {
  // Facebook / Instagram, fil d'actualité
  carre: { width: 1080, height: 1080, variant: "agence" },
  // Variante « propriétaires »
  "carre-proprietaires": { width: 1080, height: 1080, variant: "proprietaire" },
  // Story Instagram / Facebook, statut WhatsApp, TikTok
  story: { width: 1080, height: 1920, variant: "agence" },
  // Lien partagé Facebook / LinkedIn
  banniere: { width: 1200, height: 628, variant: "agence" },
} as const;

export type AdFormat = keyof typeof AD_FORMATS;

const NAVY = "#0b1020";
const GREEN = "#34d399";
const BLUE = "#2548eb";

const COPY = {
  agence: {
    eyebrow: "Agences immobilières · Afrique de l'Ouest",
    title: ["Vos loyers encaissés", "à l'heure, chaque mois."],
    points: ["Relances SMS et WhatsApp automatiques", "Paiement Wave, Orange Money, MTN, Moov", "Quittances PDF en un clic"],
    cta: "Essai gratuit 14 jours",
  },
  proprietaire: {
    eyebrow: "Propriétaires bailleurs",
    title: ["Sachez qui a payé", "son loyer, sans relancer."],
    points: ["Vos locataires paient par Mobile Money", "Relances et quittances automatiques", "Gratuit jusqu'à 5 logements"],
    cta: "Inscription gratuite",
  },
} as const;

const ROWS = [
  { name: "A. Koné", unit: "Résidence Baobab · A1", amount: "150 000", status: "Payé", color: GREEN },
  { name: "F. Bamba", unit: "Résidence Baobab · B4", amount: "90 000", status: "Partiel", color: "#fbbf24" },
  { name: "Y. Traoré", unit: "Villa Plateau", amount: "350 000", status: "En retard", color: "#f87171" },
  { name: "M. Diallo", unit: "Magasin 12", amount: "75 000", status: "Payé", color: GREEN },
];

function Mark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: `linear-gradient(135deg, ${BLUE}, #1e2d8a)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
        <path d="m9 15 2.2 2.2L15.5 13" />
      </svg>
    </div>
  );
}

function Check({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, background: "rgba(52,211,153,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

/** Aperçu du tableau de bord (illustratif). */
function Phone({ scale }: { scale: number }) {
  const s = (n: number) => n * scale;
  return (
    <div style={{ width: s(460), background: "#ffffff", borderRadius: s(36), padding: s(28), display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: s(24), fontWeight: 700, color: "#0f172a", display: "flex" }}>Collecte des loyers</div>
        <div style={{ fontSize: s(16), color: "#64748b", display: "flex" }}>Novembre</div>
      </div>
      <div style={{ display: "flex", marginTop: s(18), gap: s(12) }}>
        {[
          ["Attendu", "665 000", "#0f172a"],
          ["Encaissé", "315 000", "#047857"],
        ].map(([label, value, color]) => (
          <div key={label} style={{ flex: 1, border: "2px solid #e2e8f0", borderRadius: s(16), padding: s(14), display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: s(14), color: "#64748b", display: "flex" }}>{label}</div>
            <div style={{ fontSize: s(26), fontWeight: 700, color, display: "flex" }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ height: s(10), background: "#f1f5f9", borderRadius: s(10), marginTop: s(16), display: "flex" }}>
        <div style={{ width: "47%", height: "100%", background: "#10b981", borderRadius: s(10), display: "flex" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: s(12) }}>
        {ROWS.map((r) => (
          <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: s(14), paddingBottom: s(14), borderBottom: "2px solid #f1f5f9" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: s(20), fontWeight: 600, color: "#0f172a", display: "flex" }}>{r.name}</div>
              <div style={{ fontSize: s(14), color: "#64748b", display: "flex" }}>{r.unit}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: s(12) }}>
              <div style={{ fontSize: s(18), fontWeight: 600, color: "#0f172a", display: "flex" }}>{r.amount}</div>
              <div style={{ fontSize: s(14), fontWeight: 700, color: "#0f172a", background: `${r.color}33`, border: `2px solid ${r.color}`, borderRadius: s(20), paddingLeft: s(10), paddingRight: s(10), paddingTop: s(3), paddingBottom: s(3), display: "flex" }}>
                {r.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function renderAd(format: AdFormat, siteHost: string) {
  const { width, height, variant } = AD_FORMATS[format];
  const copy = COPY[variant];
  const wide = width > height;
  const tall = height > width * 1.4;
  const k = wide ? 0.62 : 1;

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 18 * k }}>
      <Mark size={64 * k} />
      <div style={{ fontSize: 44 * k, fontWeight: 800, color: "#ffffff", display: "flex" }}>{BRAND.name}</div>
    </div>
  );

  const text = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignSelf: "flex-start", fontSize: 24 * k, color: GREEN, border: "2px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", borderRadius: 40, paddingLeft: 20 * k, paddingRight: 20 * k, paddingTop: 8 * k, paddingBottom: 8 * k }}>
        {copy.eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 * k }}>
        <div style={{ fontSize: (tall ? 78 : 70) * k, fontWeight: 800, color: "#ffffff", lineHeight: 1.08, display: "flex" }}>{copy.title[0]}</div>
        <div style={{ fontSize: (tall ? 78 : 70) * k, fontWeight: 800, color: GREEN, lineHeight: 1.08, display: "flex" }}>{copy.title[1]}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 * k, marginTop: 34 * k }}>
        {copy.points.map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 16 * k }}>
            <Check size={38 * k} />
            <div style={{ fontSize: 32 * k, color: "#e2e8f0", display: "flex" }}>{p}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const stackCta = !wide && !tall;
  const cta = (
    <div style={{ display: "flex", flexDirection: stackCta ? "column" : "row", alignItems: stackCta ? "flex-start" : "center", gap: (stackCta ? 16 : 24) * k }}>
      <div style={{ display: "flex", background: GREEN, color: "#022c22", fontSize: 34 * k, fontWeight: 800, borderRadius: 18 * k, paddingLeft: 34 * k, paddingRight: 34 * k, paddingTop: 20 * k, paddingBottom: 20 * k }}>
        {copy.cta} →
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 22 * k, color: "#94a3b8", display: "flex" }}>Sans carte bancaire</div>
        <div style={{ fontSize: 26 * k, color: "#ffffff", fontWeight: 600, display: "flex" }}>{siteHost}</div>
      </div>
    </div>
  );

  const background = `radial-gradient(circle at 15% 0%, rgba(59,102,246,0.45), transparent 55%), radial-gradient(circle at 100% 100%, rgba(16,185,129,0.25), transparent 50%), ${NAVY}`;

  let body;
  if (wide) {
    body = (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 48, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: 640 }}>
          {brand}
          {text}
          {cta}
        </div>
        <Phone scale={0.98} />
      </div>
    );
  } else if (tall) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", paddingLeft: 80, paddingRight: 80, paddingTop: 120, paddingBottom: 140, justifyContent: "space-between" }}>
        {brand}
        {text}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Phone scale={1.7} />
        </div>
        {cta}
      </div>
    );
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 72, justifyContent: "space-between" }}>
        {brand}
        {text}
        {cta}
        <div style={{ position: "absolute", right: -30, bottom: -150, display: "flex", transform: "rotate(-6deg)" }}>
          <Phone scale={0.7} />
        </div>
      </div>
    );
  }

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background, fontFamily: "Inter", fontWeight: 500, position: "relative", overflow: "hidden" }}>{body}</div>,
    { width, height, fonts: await fonts() },
  );
}
