import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { requireAdmin } from "../middleware/admin.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  distributeSchema,
  kycSchema,
  projectPatchSchema,
  reviewSchema,
  publishSchema,
} from "../validators/investment.validator";

const router = Router();

// Todo el namespace /admin exige rol admin.
router.use(requireAuth, requireAdmin);

router.get("/users", adminController.users);
router.get("/applications", adminController.applications);
router.patch(
  "/applications/:id/review",
  validateBody(reviewSchema),
  adminController.review,
);
router.post(
  "/applications/:id/publish",
  validateBody(publishSchema),
  adminController.publish,
);

// Habilitación manual de KYC (demostración).
router.post(
  "/users/:id/kyc",
  validateBody(kycSchema),
  adminController.setUserKyc,
);

// Transiciones de estado confirmadas por el contrato académico.
router.patch(
  "/projects/:slug",
  validateBody(projectPatchSchema),
  adminController.updateProject,
);
router.get("/projects/:slug/distributions", adminController.listDistributions);

// Distribución de ingresos de un período (solo si la franquicia está en operación).
router.post(
  "/distributions",
  validateBody(distributeSchema),
  adminController.distribute,
);

export default router;
