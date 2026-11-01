import { Router } from "express";
import * as accountController from "../controllers/account.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  draftSchema,
  franchiseApplicationSchema,
  profileSchema,
} from "../validators/account.validator";
import {
  walletChallengeSchema,
  walletLinkSchema,
} from "../validators/blockchain.validator";

const router = Router();

// Todas las rutas de cuenta exigen autenticación.
router.use(requireAuth);

router.get("/profile", accountController.getProfile);
router.put("/profile", validateBody(profileSchema), accountController.saveProfile);

router.get("/holdings", accountController.getHoldings);

router.get("/applications", accountController.getApplications);
router.post(
  "/applications",
  validateBody(franchiseApplicationSchema),
  accountController.submitApplication,
);

router.get("/draft", accountController.getDraft);
router.put("/draft", validateBody(draftSchema), accountController.saveDraft);
router.delete("/draft", accountController.clearDraft);

// Wallet EVM vinculada (con prueba de control mediante desafío firmado).
router.get("/wallet", accountController.getWallet);
router.post(
  "/wallet/challenge",
  validateBody(walletChallengeSchema),
  accountController.requestWalletChallenge,
);
router.put("/wallet", validateBody(walletLinkSchema), accountController.linkWallet);

export default router;
