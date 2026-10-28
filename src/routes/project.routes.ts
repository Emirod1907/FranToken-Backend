import { Router } from "express";
import * as projectController from "../controllers/project.controller";

const router = Router();

// Catálogo público del marketplace.
router.get("/", projectController.list);
router.get("/:slug", projectController.detail);

export default router;
