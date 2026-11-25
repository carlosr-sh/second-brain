import { z } from "./z";

/** Money is ALWAYS integer cents. Floats are never used for amounts. */
export const MAX_CENTS = 1_000_000_000_00; // R$ 1 bilhão: sanity bound for a personal app

/**
 * Parses a user-typed BRL amount into cents using string math (no floats).
 * Accepts "1.234,56", "1234,56", "1234.56", "R$ 12", "12,5". Returns null if invalid.
 * Brazilian convention: "," is the decimal separator; "." groups thousands.
 * A lone "." followed by 1–2 digits is treated as a decimal point ("12.5").
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s || /[^0-9.,]/.test(s)) return null;
  if (s.includes(",")) {
    // "1.234,56" or "1234,5": thousands groups of 3, at most 2 decimals, nothing after.
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{0,2}$/.test(s)) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // decimal point
  } else {
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s)) return null;
    s = s.replace(/\./g, "");
  }
  const [int = "", frac = ""] = s.split(".");
  if (!/^\d+$/.test(int) || frac.length > 2 || (frac && !/^\d+$/.test(frac))) return null;
  const cents = Number(int) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** Display only: cents → "R$ 1.234,56" (sign preserved). */
export const formatBRL = (cents: number): string => brl.format(cents / 100);

/** Positive amount in cents (sign comes from the transaction kind). */
export const amountCentsSchema = z.number().int("Valor em centavos").positive("O valor deve ser maior que zero").max(MAX_CENTS);
/** Signed amount (opening balances: credit cards start negative). */
export const signedCentsSchema = z.number().int().min(-MAX_CENTS).max(MAX_CENTS);
