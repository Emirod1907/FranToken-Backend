import { Router } from "express";
import * as controller from "../controllers/franchise.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  operationSchema,
  distributionRequestSchema,
  editDistributionRequestSchema,
} from "../validators/franchise.validator";

const router = Router();
router.use(requireAuth);
router.get("/", controller.list);
router.get("/:id", controller.detail);
router.patch(
  "/:id/operation",
  validateBody(operationSchema),
  controller.operation,
);
router.get("/:id/distribution-requests", controller.listRequests);
router.post(
  "/:id/distribution-requests",
  validateBody(distributionRequestSchema),
  controller.propose,
);
router.patch(
  "/:id/distribution-requests/:requestId",
  validateBody(editDistributionRequestSchema),
  controller.editRequest,
);
export default router;
