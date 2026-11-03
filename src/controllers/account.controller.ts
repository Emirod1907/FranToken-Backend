import type { Request, Response } from "express";
import * as accountService from "../services/account.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

function userId(req: Request): string {
  if (!req.user) throw ApiError.unauthorized();
  return req.user.id;
}

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json(accountService.getWallet(req.user));
});

export const requestWalletChallenge = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    res.json(
      await accountService.requestWalletChallenge(req.user, req.body.walletAddress),
    );
  },
);

export const linkWallet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json(
    await accountService.linkWallet(
      req.user,
      req.body.walletAddress,
      req.body.signature,
    ),
  );
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await accountService.getProfile(userId(req));
  res.json({ profile });
});

export const saveProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await accountService.saveProfile(userId(req), req.body);
  res.json(result);
});

export const getHoldings = asyncHandler(async (req: Request, res: Response) => {
  const holdings = await accountService.getHoldings(userId(req));
  res.json({ holdings });
});

export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const applications = await accountService.getApplications(userId(req));
    res.json({ applications });
  },
);

export const submitApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application = await accountService.submitFranchise(
      userId(req),
      req.body,
    );
    res.status(201).json({ application });
  },
);

export const getDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await accountService.getDraft(userId(req));
  res.json({ draft });
});

export const saveDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await accountService.saveDraft(userId(req), req.body.payload);
  res.json({ draft });
});

export const clearDraft = asyncHandler(async (req: Request, res: Response) => {
  await accountService.clearDraft(userId(req));
  res.status(204).send();
});
