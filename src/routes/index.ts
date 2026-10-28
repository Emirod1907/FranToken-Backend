import { Router } from "express";
import accountRoutes from "./account.routes";
import authRoutes from "./auth.routes";
import blockchainRoutes from "./blockchain.routes";
import projectRoutes from "./project.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "frantoken-backend", time: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/account", accountRoutes);
router.use("/projects", projectRoutes);
router.use("/blockchain", blockchainRoutes);

export default router;
