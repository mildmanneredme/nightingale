/**
 * C-05: Standalone CLI entry point for `npm run migrate` (F-024).
 *
 * Connects to the database, runs outstanding migrations, then exits.
 * Exits with code 1 if any migration fails (F-026).
 *
 * Usage:
 *   npm run migrate
 *   ts-node src/db/runMigrations.ts
 */

import { pool } from "../db";
import { runMigrations } from "./migrations";
import { logger } from "../logger";

(async () => {
  try {
    const result = await runMigrations(pool);
    logger.info(result, "Migration run complete");
    await pool.end();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Migration run failed — exiting with code 1");
    await pool.end().catch(() => undefined); // best-effort cleanup
    process.exit(1);
  }
})();
