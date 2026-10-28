import type { Request, Response } from "express";
import { toSession } from "../models/user.model";
import * as authService from "../services/auth.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  res.json(result);
});

export const session = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json({ session: toSession(req.user) });
});

export const updateDisplayName = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const session = await authService.updateDisplayName(
      req.user,
      req.body.displayName,
    );
    res.json({ session });
  },
);

// El logout es responsabilidad del cliente (descarta el token). Se expone
// por simetría del contrato; con JWT stateless no hay estado que invalidar aquí.
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ ok: true });
});
