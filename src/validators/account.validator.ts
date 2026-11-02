import { z } from "zod";

const birthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10)
    );
  }, "Fecha de nacimiento inválida o futura.");
export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30),
  country: z.string().trim().min(2).max(60),
  investorUpdates: z.boolean(),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,9}$/, "DNI de 7 a 9 dígitos."),
  cuil: z
    .string()
    .transform((v) => v.replace(/[- ]/g, ""))
    .pipe(z.string().regex(/^\d{11}$/, "CUIL de 11 dígitos.")),
  birthDate,
  province: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(200),
  postalCode: z.string().trim().min(3).max(20),
});
export const franchiseApplicationSchema = z.object({
  franchiseName: z.string().trim().min(2).max(100),
  sector: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  totalCost: z.number().finite().positive(),
  currency: z.enum(["USD", "ARS"]),
  description: z.string().trim().min(20).max(4000),
  operatorName: z.string().trim().min(2).max(120),
  estimatedOpening: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  performanceSource: z
    .string()
    .trim()
    .max(255)
    .default("No aplica: proyecto nuevo"),
  year1: z.number().int().optional(),
  revenue1: z.number().nonnegative().optional(),
  margin1: z.number().min(-100).max(100).optional(),
  year2: z.number().int().optional(),
  revenue2: z.number().nonnegative().optional(),
  margin2: z.number().min(-100).max(100).optional(),
  year3: z.number().int().optional(),
  revenue3: z.number().nonnegative().optional(),
  margin3: z.number().min(-100).max(100).optional(),
});
export const draftSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
});
export type ProfileInput = z.infer<typeof profileSchema>;
export type FranchiseApplicationInput = z.infer<
  typeof franchiseApplicationSchema
>;
export type DraftInput = z.infer<typeof draftSchema>;
