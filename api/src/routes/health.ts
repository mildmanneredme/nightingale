import { Router } from "express";
import { checkDb } from "../db";
import { config } from "../config";

const router = Router();

// Liveness — ALB and ECS use this. Fast, no DB check.
router.get("/health", (_req, res) => {
  res.json({ status: "ok", env: config.env });
});

// Readiness — confirms DB is reachable. Use for deployment smoke tests.
router.get("/ready", async (_req, res) => {
  try {
    await checkDb();
    res.json({ status: "ready", db: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable", db: "error" });
  }
});

export default router;
