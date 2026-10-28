import { z } from "zod";

// Espejo de profileSchema del frontend (features/account/services/account.service.ts).
export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30),
  country: z.string().trim().min(2).max(60),
  investorUpdates: z.boolean(),
});

// Espejo de applicationSchema del frontend + validación de años ascendentes.
export const franchiseApplicationSchema = z
  .object({
    franchiseName: z.string().trim().min(2).max(100),
    sector: z.string().trim().min(2),
    city: z.string().trim().min(2),
    country: z.string().trim().min(2),
    totalCost: z.number().positive(),
    currency: z.enum(["USD", "ARS"]),
    description: z.string().trim().min(40),
    operatorName: z.string().trim().min(2),
    estimatedOpening: z.string().min(7),
    performanceSource: z.string().trim().min(5),
    year1: z.number().int().min(2000),
    revenue1: z.number().nonnegative(),
    margin1: z.number().min(-100).max(100),
    year2: z.number().int().min(2000),
    revenue2: z.number().nonnegative(),
    margin2: z.number().min(-100).max(100),
    year3: z.number().int().min(2000),
    revenue3: z.number().nonnegative(),
    margin3: z.number().min(-100).max(100),
  })
  .refine((d) => d.year1 < d.year2 && d.year2 < d.year3, {
    message: "Los años de rendimiento deben estar en orden ascendente.",
    path: ["year2"],
  });

// El borrador es estado de UI opaco: se acepta cualquier objeto JSON.
export const draftSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type FranchiseApplicationInput = z.infer<typeof franchiseApplicationSchema>;
export type DraftInput = z.infer<typeof draftSchema>;
