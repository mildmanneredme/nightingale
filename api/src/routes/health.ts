import { Router } from "express";
import { checkDb } from "../db";
import { config } from "../config";
import { getMigrationResult } from "../db/migrations";

const router = Router();

// Liveness — ALB and ECS use this. Fast, no DB check.
// F-027: includes cached migration counts (no extra DB round-trip).
router.get("/health", (_req, res) => {
  const migrations = getMigrationResult();
  res.json({
    status: "ok",
    env: config.env,
    db: {
      migrations: migrations ?? { applied: 0, pending: 0 },
    },
  });
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
