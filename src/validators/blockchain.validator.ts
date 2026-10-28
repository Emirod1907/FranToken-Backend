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

export const walletSchema = z.object({
  walletAddress: evmAddress,
});
