import type { Request, Response } from "express";
import * as projectService from "../services/project.service";
import { asyncHandler } from "../utils/asyncHandler";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const projects = await projectService.listProjects();
  res.json({ projects });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getProjectBySlug(req.params.slug);
  res.json({ project });
});
