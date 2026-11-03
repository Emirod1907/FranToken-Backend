import { Router } from "express";
import * as controller from "../controllers/blockchain.controller";
import { requireAdmin } from "../middleware/admin.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  distributeSchema,
  freezeSchema,
  kycSchema,
  mintSchema,
  pauseSchema,
  subscriptionSchema,
} from "../validators/blockchain.validator";

const router = Router();
// Las escrituras del MVP pasan por compras/administración con intención persistida.
router.use((req, res, next) => {
  if (req.method !== "GET") {
    res
      .status(410)
      .json({
        error: {
          message:
            "Usá los endpoints de cuenta y administración del MVP integrado.",
        },
      });
    return;
  }
  next();
});

// ─── Lecturas públicas ──────────────────────────────────────
router.get("/status", controller.status);
router.get("/token", controller.tokenInfo);
router.get("/compliance", controller.complianceInfo);
router.get("/holders/:address", controller.holder);

// ─── Lectura del usuario autenticado ────────────────────────
router.get("/me", requireAuth, controller.myHolding);

// ─── Operaciones de agente (admin + firmante del servidor) ──
router.post(
  "/kyc",
  requireAuth,
  requireAdmin,
  validateBody(kycSchema),
  controller.kyc,
);
router.post(
  "/mint",
  requireAuth,
  requireAdmin,
  validateBody(mintSchema),
  controller.mint,
);
router.post(
  "/freeze",
  requireAuth,
  requireAdmin,
  validateBody(freezeSchema),
  controller.freeze,
);
router.post(
  "/pause",
  requireAuth,
  requireAdmin,
  validateBody(pauseSchema),
  controller.pause,
);
router.post(
  "/distribute",
  requireAuth,
  requireAdmin,
  validateBody(distributeSchema),
  controller.distribute,
);

// Emisión mediante C4 (compra conciliada por el verificador de pagos).
router.post(
  "/subscriptions/issue",
  requireAuth,
  requireAdmin,
  validateBody(subscriptionSchema),
  controller.issueSubscription,
);

export default router;
