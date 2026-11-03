import { z } from "zod";

const decimalAmount = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/, "Importe de hasta seis decimales.");

export const buySchema = z.object({
  projectId: z.string().trim().min(1),
  units: z.union([
    z.string().regex(/^[1-9]\d{0,5}$/),
    z.number().int().positive().max(1000000),
  ]),
  requestId: z.string().uuid(),
});

export const claimSchema = z.object({
  projectId: z.string().trim().min(1),
});

// Período mensual: "AAAA-MM".
export const distributeSchema = z.object({
  projectId: z.string().trim().min(1),
  periodId: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período AAAA-MM."),
  amount: decimalAmount,
  memo: z.string().trim().max(160).optional(),
});

export const kycSchema = z.object({
  approved: z.boolean(),
});

export const projectPatchSchema = z
  .object({ status: z.enum(["publicada", "en_operacion", "cerrada"]) })
  .strict();
export const reviewSchema = z.object({
  status: z.enum(["Aprobada", "Observada"]),
  note: z.string().trim().max(500).default(""),
});
export const publishSchema = z.object({
  symbol: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/),
  totalUnits: z
    .string()
    .regex(/^[1-9]\d{0,6}$/)
    .refine((v) => BigInt(v) <= 1000000n),
});
