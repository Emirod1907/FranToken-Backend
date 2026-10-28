import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Exige que el usuario autenticado tenga rol 'admin'. Debe ir después de
 * requireAuth. Gobierna las operaciones de agente on-chain.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== "admin") {
    return next(ApiError.forbidden("Se requiere rol de administrador."));
  }
  next();
}
