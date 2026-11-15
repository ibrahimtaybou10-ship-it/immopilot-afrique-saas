import { ImageResponse } from "next/og";

/**
 * Icône de l'application rendue en PNG (écran d'accueil Android / iPhone).
 * `maskable` : fond plein bord à bord et motif réduit, pour les masques ronds d'Android.
 */
export function appIcon(size: number, maskable = false) {
  const glyph = Math.round(size * (maskable ? 0.5 : 0.6));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2548eb 0%, #1e2d8a 100%)",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="m9 15 2.2 2.2L15.5 13" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
