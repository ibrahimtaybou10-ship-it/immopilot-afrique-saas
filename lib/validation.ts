import { z } from "zod";
import { MANUAL_METHODS } from "./format";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 ().-]{6,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const required = (label: string, max = 120) =>
  z.string({ error: `${label} : champ requis` }).trim().min(1, `${label} : champ requis`).max(max, `${label} : texte trop long`);

const optional = (max = 160) =>
  z
    .string()
    .trim()
    .max(max, "Texte trop long")
    .optional()
    .transform((v) => (v ? v : null));

const amount = (label: string) =>
  z.coerce
    .number({ error: `${label} : montant invalide` })
    .int(`${label} : montant entier attendu`)
    .min(0, `${label} : montant négatif interdit`)
    .max(1_000_000_000, `${label} : montant trop élevé`);

const email = z.string().trim().toLowerCase().regex(EMAIL_RE, "Adresse e-mail invalide");
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || EMAIL_RE.test(v), "Adresse e-mail invalide");
const phone = z.string().trim().regex(PHONE_RE, "Numéro de téléphone invalide (ex. +225 07 08 11 22 33)");
const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || PHONE_RE.test(v), "Numéro de téléphone invalide");
const uuid = (label: string) => z.string().regex(UUID_RE, `${label} : sélection invalide`);
const dueDay = z.coerce.number().int().min(1, "Jour d'échéance : entre 1 et 28").max(28, "Jour d'échéance : entre 1 et 28");

export const PROPERTY_TYPE_VALUES = ["IMMEUBLE", "RESIDENCE", "VILLA", "COMMERCIAL"] as const;
export const UNIT_TYPE_VALUES = [
  "STUDIO", "CHAMBRE", "F2", "F3", "F4", "F5", "VILLA", "DUPLEX", "MAGASIN", "BUREAU", "ENTREPOT",
] as const;
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis"),
});

export const signupSchema = z.object({
  full_name: required("Nom complet", 80),
  agency_name: required("Nom de l'agence", 80),
  account_type: z.enum(["AGENCY", "OWNER"]).default("AGENCY"),
  country: required("Pays", 60),
  email,
  password: z.string().min(8, "Mot de passe : 8 caractères minimum").max(72, "Mot de passe trop long"),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "Mot de passe : 8 caractères minimum").max(72, "Mot de passe trop long"),
});

export const onboardingSchema = z.object({
  agency_name: required("Nom de l'agence", 80),
  account_type: z.enum(["AGENCY", "OWNER"]).default("AGENCY"),
  country: required("Pays", 60),
  city: optional(60),
  phone: optionalPhone,
});

export const propertySchema = z.object({
  name: required("Nom du bien", 100),
  property_type: z.enum(PROPERTY_TYPE_VALUES, { error: "Type de bien invalide" }),
  address: required("Adresse", 160),
  city: required("Ville", 60),
  units_count: z.coerce.number().int().min(1, "Nombre de lots : 1 minimum").max(200, "Nombre de lots : 200 maximum par création"),
  unit_type: z.enum(UNIT_TYPE_VALUES, { error: "Type de lot invalide" }),
  base_rent: amount("Loyer"),
  charges_amount: amount("Charges"),
});

export const unitSchema = z.object({
  property_id: uuid("Bien"),
  unit_number: required("Référence du lot", 40),
  unit_type: z.enum(UNIT_TYPE_VALUES, { error: "Type de lot invalide" }),
  base_rent: amount("Loyer"),
  charges_amount: amount("Charges"),
});

export const leaseSchema = z.object({
  full_name: required("Nom du locataire", 100),
  phone,
  email: optionalEmail,
  profession: optional(100),
  id_card_number: optional(60),
  unit_id: uuid("Lot"),
  monthly_rent: amount("Loyer mensuel"),
  charges_amount: amount("Charges"),
  deposit_amount: amount("Caution"),
  due_day: dueDay,
  start_date: z.string().regex(DATE_RE, "Date d'entrée invalide"),
  // Impayés antérieurs (case cochée = le locataire doit déjà de l'argent)
  has_arrears: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  arrears_amount: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v.replace(/\s/g, "")) : 0))
    .refine((n) => Number.isInteger(n) && n >= 0 && n <= 1_000_000_000, "Montant des impayés invalide"),
  arrears_note: optional(200),
}).refine((v) => !v.has_arrears || v.arrears_amount >= 1, {
  message: "Indiquez le montant des impayés, ou décochez la case.",
  path: ["arrears_amount"],
});

export const terminateSchema = z.object({
  lease_id: uuid("Bail"),
  end_date: z.string().regex(DATE_RE, "Date de sortie invalide"),
});

export const paymentSchema = z.object({
  invoice_id: uuid("Échéance"),
  // Montant ignoré quand plusieurs mois sont payés : il est alors calculé par la base.
  amount: z.coerce.number({ error: "Montant invalide" }).int("Montant entier attendu").min(0).max(1_000_000_000).default(0),
  method: z.enum(MANUAL_METHODS, { error: "Mode de paiement invalide" }),
  note: optional(200),
  months: z.coerce.number().int().min(1, "Nombre de mois invalide").max(24, "24 mois maximum").default(1),
}).refine((v) => v.months > 1 || v.amount >= 1, { message: "Le montant doit être supérieur à zéro", path: ["amount"] });

export const agencySchema = z.object({
  name: required("Nom de l'agence", 80),
  phone: optionalPhone,
  email: optionalEmail,
  address: optional(160),
  city: optional(60),
  country: optional(60),
  rccm_number: optional(60),
  nif_number: optional(60),
  default_due_day: dueDay,
  sms_sender_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-Za-z0-9 ]{3,11}$/.test(v), "Nom d'expéditeur SMS : 3 à 11 lettres ou chiffres"),
  auto_reminders: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
