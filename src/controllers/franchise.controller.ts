import type { Request, Response } from "express";
import * as franchises from "../services/franchise.service";
import * as requests from "../services/distributionRequest.service";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

function actor(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
export const application = asyncHandler(async (req: Request, res: Response) => {
  res.json(await franchises.applicationDetail(actor(req), req.params.id));
});
export const editApplication = asyncHandler(
  async (req: Request, res: Response) => {
    res.json(
      await franchises.editApplication(actor(req), req.params.id, req.body),
    );
  },
);
export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ franchises: await franchises.managedFranchises(actor(req)) });
});
export const detail = asyncHandler(async (req: Request, res: Response) => {
  res.json(await franchises.franchiseDetail(actor(req), req.params.id));
});
export const operation = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    await franchises.setFranchiseOperation(
      actor(req),
      req.params.id,
      req.body.status,
    ),
  );
});
export const listRequests = asyncHandler(
  async (req: Request, res: Response) => {
    res.json({
      requests: await requests.listDistributionRequests(
        actor(req),
        req.params.id,
      ),
    });
  },
);
export const propose = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(201)
    .json({
      request: await requests.proposeDistribution(
        actor(req),
        req.params.id,
        req.body,
      ),
    });
});
export const editRequest = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    request: await requests.editDistributionRequest(
      actor(req),
      req.params.id,
      req.params.requestId,
      req.body,
    ),
  });
});
export const allRequests = asyncHandler(async (req: Request, res: Response) => {
  res.json({ requests: await requests.listDistributionRequests(actor(req)) });
});
export const observe = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    request: await requests.observeDistributionRequest(
      actor(req),
      req.params.id,
      req.body.version,
      req.body.note,
    ),
  });
});
export const execute = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    await requests.executeDistributionRequest(
      actor(req),
      req.params.id,
      req.body.version,
    ),
  );
});
