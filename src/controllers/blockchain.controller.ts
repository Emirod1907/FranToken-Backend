import type { Request, Response } from "express";
import * as blockchain from "../services/blockchain.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

// ─── Lecturas ────────────────────────────────────────────────

export const status = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await blockchain.getStatus());
});

export const tokenInfo = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ token: await blockchain.getTokenInfo() });
});

export const complianceInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json({ compliance: await blockchain.getComplianceInfo() });
  },
);

export const holder = asyncHandler(async (req: Request, res: Response) => {
  res.json({ holder: await blockchain.getHolder(req.params.address) });
});

// Tenencia on-chain del usuario autenticado (según su wallet vinculada).
export const myHolding = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.user.walletAddress) {
    throw ApiError.badRequest(
      "No tenés una wallet vinculada. Vinculala con PUT /api/account/wallet.",
    );
  }
  res.json({ holder: await blockchain.getHolder(req.user.walletAddress) });
});

// ─── Escrituras (admin + agente) ─────────────────────────────

export const kyc = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await blockchain.registerIdentity(req.body));
});

export const mint = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await blockchain.mint(req.body));
});

export const freeze = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await blockchain.setAddressFrozen(req.body));
});

export const pause = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await blockchain.setPaused(req.body.paused));
});

export const distribute = asyncHandler(async (req: Request, res: Response) => {
  res.status(202).json(await blockchain.distributeRevenue(req.body));
});
