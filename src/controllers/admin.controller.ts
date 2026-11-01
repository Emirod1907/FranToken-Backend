import type { Request, Response } from "express";
import * as adminService from "../services/admin.service";
import * as distribution from "../services/distribution.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const setUserKyc = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.setUserKyc(req.params.id, req.body.approved);
  res.json(result);
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await adminService.updateProject(req.params.slug, req.body);
  res.json({ project });
});

export const distribute = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await distribution.distribute(req.user.id, req.body);
  res.status(result.idempotent ? 200 : 201).json(result);
});

export const listDistributions = asyncHandler(async (req: Request, res: Response) => {
  const distributions = await distribution.listDistributions(req.params.slug);
  res.json({ distributions });
});
