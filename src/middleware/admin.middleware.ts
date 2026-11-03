import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Exige que el usuario autenticado tenga rol 'superadmin'. Debe ir después de
 * requireAuth. Gobierna las operaciones de agente on-chain.
 */
export function requireSuperadmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== "superadmin") {
    return next(ApiError.forbidden("Se requiere acceso de superadmin."));
  }
  next();
}
