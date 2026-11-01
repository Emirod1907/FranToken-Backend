import { z } from "zod";

const evmAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Dirección EVM inválida.");

const decimalAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Importe inválido (número decimal como texto).");

const integerString = z
  .string()
  .trim()
  .regex(/^\d+$/, "Debe ser un entero como texto.");

export const buySchema = z.object({
  projectId: z.string().trim().min(1),
  units: z.number().int().positive(),
});

export const claimSchema = z.object({
  projectId: z.string().trim().min(1),
});

// Período mensual: "AAAA-MM".
export const distributeSchema = z.object({
  projectId: z.string().trim().min(1),
  periodId: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período AAAA-MM."),
  amount: decimalAmount,
  memo: z.string().trim().max(160).optional(),
});

export const kycSchema = z.object({
  approved: z.boolean(),
});

export const projectPatchSchema = z
  .object({
    status: z.enum(["publicada", "en_operacion", "cerrada"]).optional(),
    unitPriceMinor: integerString.optional(),
    tokenSymbol: z.string().trim().max(40).optional(),
    tokenAddress: evmAddress.optional(),
    investmentAgreementAddress: evmAddress.optional(),
    totalUnits: integerString.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para actualizar." });
