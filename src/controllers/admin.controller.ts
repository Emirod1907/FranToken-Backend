import type { Request, Response } from "express";
import * as adminService from "../services/admin.service";
import * as distribution from "../services/distribution.service";
import { distributeAsSuperadmin } from "../services/distributionRequest.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const setUserKyc = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await adminService.setUserKyc(
    req.user,
    req.params.id,
    req.body.approved,
  );
  res.json(result);
});

export const updateProject = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const project = await adminService.updateProject(req.user, req.params.slug, req.body);
    res.json(project);
  },
);

export const distribute = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await distributeAsSuperadmin(req.user, req.body);
  res.status(result.idempotent ? 200 : 201).json(result);
});

export const listDistributions = asyncHandler(
  async (req: Request, res: Response) => {
    const distributions = await distribution.listDistributions(req.params.slug);
    res.json({ distributions });
  },
);

export const users = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ users: await adminService.listUsers() });
});
export const applications = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json({ applications: await adminService.listApplications() });
  },
);
export const review = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json({
    application: await adminService.reviewApplication(
      req.user,
      req.params.id,
      req.body.status,
      req.body.note,
      req.body.version,
    ),
  });
});
export const publish = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  res.json({
    project: await adminService.publishApplication(
      req.user,
      req.params.id,
      req.body.symbol,
      req.body.totalUnits,
    ),
  });
});
