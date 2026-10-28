import type { NextFunction, Request, Response } from "express";
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyToken } from "../utils/jwt";

/**
 * Exige un Bearer token válido y carga el usuario en req.user.
 * La protección de rutas vive en el servidor; la guardia del cliente solo
 * controla la experiencia visual (ver ACCOUNT-DEMO.md del frontend).
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw ApiError.unauthorized("Falta el token Bearer.");
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized("Token inválido o expirado.");
    }

    const user = await User.findByPk(payload.sub);
    if (!user) {
      throw ApiError.unauthorized("La sesión ya no es válida.");
    }

    req.user = user;
    next();
  },
);
