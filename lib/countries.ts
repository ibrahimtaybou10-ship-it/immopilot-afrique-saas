/** Pays de la zone franc (UEMOA puis CEMAC) et voisins francophones, avec leur code ISO2. */
export const COUNTRY_CODES = {
  "Bénin": "BJ",
  "Burkina Faso": "BF",
  "Côte d'Ivoire": "CI",
  "Guinée-Bissau": "GW",
  "Mali": "ML",
  "Niger": "NE",
  "Sénégal": "SN",
  "Togo": "TG",
  "Cameroun": "CM",
  "Centrafrique": "CF",
  "Congo": "CG",
  "Gabon": "GA",
  "Guinée équatoriale": "GQ",
  "Tchad": "TD",
  "Guinée": "GN",
  "Mauritanie": "MR",
  "RD Congo": "CD",
} as const;

/** Liste proposée à l'inscription. */
export const COUNTRIES = Object.keys(COUNTRY_CODES) as (keyof typeof COUNTRY_CODES)[];

export const countryCode = (name: string | null | undefined): string | null =>
  name && name in COUNTRY_CODES ? COUNTRY_CODES[name as keyof typeof COUNTRY_CODES] : null;
