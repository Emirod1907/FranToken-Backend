import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { ApiError } from "../utils/ApiError";

/**
 * Valida req.body con un esquema Zod y reemplaza el body por el valor parseado.
 * Ante error, responde 400 con el detalle de los campos.
 */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(ApiError.badRequest("Datos inválidos.", details));
    }
    req.body = result.data as ZodInfer<T>;
    next();
  };
}
