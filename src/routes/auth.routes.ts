import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  displayNameSchema,
  loginSchema,
  registerSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/session", requireAuth, authController.session);
router.patch(
  "/display-name",
  requireAuth,
  validateBody(displayNameSchema),
  authController.updateDisplayName,
);

export default router;
