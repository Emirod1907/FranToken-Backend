/**
 * Utilidades de dinero en "unidades mínimas" (minor units), como strings/BigInt,
 * para no perder precisión. Ej.: USD 10 con 6 decimales = "10000000".
 */

export function minor(units: string | number | bigint): bigint {
  return typeof units === "bigint" ? units : BigInt(units);
}

/** Convierte unidades mínimas a texto mayor ("50000000", 6) -> "50.000000". */
export function toMajorString(value: string | bigint, decimals: number): string {
  const v = typeof value === "bigint" ? value : BigInt(value);
  const neg = v < 0n;
  const abs = (neg ? -v : v).toString().padStart(decimals + 1, "0");
  const intPart = abs.slice(0, abs.length - decimals);
  const fracPart = decimals ? "." + abs.slice(abs.length - decimals) : "";
  return (neg ? "-" : "") + intPart + fracPart;
}

/** Igual que toMajorString pero como número (para contratos del frontend). */
export function toMajorNumber(value: string | bigint, decimals: number): number {
  return Number(toMajorString(value, decimals));
}

/** gross = units * unitPriceMinor, en unidades mínimas (string). */
export function grossMinor(units: string | number, unitPriceMinor: string): string {
  return (minor(units) * minor(unitPriceMinor)).toString();
}

/** Convierte un importe mayor en texto ("1000.50", 6) a unidades mínimas ("1000500000"). */
export function majorToMinor(amount: string, decimals: number): string {
  const [intPart, fracRaw = ""] = amount.trim().split(".");
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  const scaled = BigInt(intPart || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
  return scaled.toString();
}
