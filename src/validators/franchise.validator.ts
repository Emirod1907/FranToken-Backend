import { z } from "zod";
import { franchiseApplicationSchema } from "./account.validator";
import { distributeSchema } from "./investment.validator";

export const versionSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
export const editApplicationSchema = franchiseApplicationSchema
  .omit({
    year1: true,
    revenue1: true,
    margin1: true,
    year2: true,
    revenue2: true,
    margin2: true,
    year3: true,
    revenue3: true,
    margin3: true,
  })
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "version"),
    "Ingresá al menos un cambio.",
  );
export type EditApplicationInput = z.infer<typeof editApplicationSchema>;

export const operationSchema = z
  .object({ status: z.enum(["en_operacion", "cerrada"]) })
  .strict();
export const distributionRequestSchema = distributeSchema
  .omit({ projectId: true })
  .strict();
export const editDistributionRequestSchema = distributionRequestSchema
  .omit({ periodId: true })
  .extend({ version: z.number().int().positive() })
  .strict();
export const observeDistributionSchema = z
  .object({
    version: z.number().int().positive(),
    note: z.string().trim().min(1).max(500),
  })
  .strict();
