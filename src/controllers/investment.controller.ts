import type { Request, Response } from "express";
import * as investment from "../services/investment.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

function user(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export const buy = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await investment.buyTokens(user(req), req.body);
  res.status(201).json({ purchase });
});

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const purchases = await investment.listPurchases(user(req).id);
  res.json({ purchases });
});

export const getHoldings = asyncHandler(async (req: Request, res: Response) => {
  const holdings = await investment.getHoldings(user(req).id);
  res.json({ holdings });
});

export const claim = asyncHandler(async (req: Request, res: Response) => {
  const result = await investment.claimRevenue(user(req).id, req.body.projectId);
  res.json(result);
});
