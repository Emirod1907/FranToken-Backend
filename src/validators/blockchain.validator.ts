import { z } from "zod";

const evmAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Dirección EVM inválida.");

// Cantidad como string decimal (p. ej. "100" o "0.5"); se convierte con los
// decimales del contrato correspondiente. String evita pérdida de precisión.
const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Cantidad inválida (usar número decimal como texto).");

export const kycSchema = z.object({
  address: evmAddress,
  identity: evmAddress,
  country: z.number().int().min(0).max(65535),
});

export const mintSchema = z.object({
  address: evmAddress,
  amount: decimalString,
});

export const freezeSchema = z.object({
  address: evmAddress,
  frozen: z.boolean(),
});

export const pauseSchema = z.object({
  paused: z.boolean(),
});

export const distributeSchema = z.object({
  amount: decimalString,
  memo: z.string().trim().min(1).max(120),
});

// Hash bytes32 (0x + 64 hex) y entero como texto (unidades mínimas / unidades).
const bytes32 = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Debe ser un hash bytes32 (0x + 64 hex).");
const integerString = z
  .string()
  .trim()
  .regex(/^\d+$/, "Debe ser un entero como texto.");

// C4 — emisión tras compra conciliada.
export const subscriptionSchema = z.object({
  purchaseId: bytes32,
  paymentReference: bytes32,
  investorAddress: evmAddress,
  units: integerString,
  paidAmountMinor: integerString,
  evidenceHash: bytes32,
});

// Firma EIP-191 (personal_sign): 0x + 130 hex.
const signature = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{130}$/, "Firma inválida.");

// Vinculación de wallet con prueba de control (desafío firmado).
export const walletChallengeSchema = z.object({
  walletAddress: evmAddress,
});
export const walletLinkSchema = z.object({
  walletAddress: evmAddress,
  signature,
});
