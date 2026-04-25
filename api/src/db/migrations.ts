/**
 * C-05: Lightweight migration runner (F-023, F-025, F-026, F-028)
 *
 * Algorithm:
 *  1. Ensure `schema_migrations` tracking table exists.
 *  2. Read all *.sql files from the migrations directory, sorted alphabetically
 *     (001_… → 014_… order).
 *  3. For each file not already recorded in `schema_migrations`, execute it
 *     inside a transaction and record the filename on success.
 *  4. Return { applied, pending } counts so /health can surface them.
 *
 * Each migration runs in its own transaction so a failure rolls back only
 * that migration.  The process must exit(1) on any failure — the caller in
 * index.ts is responsible for that (F-026).
 */

import * as fs from "fs";
import * as path from "path";
import { Pool, PoolClient } from "pg";
import { logger } from "../logger";

// Exported so tests can override with a mock pool
export const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../../../infra/database/migrations"
);

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL      PRIMARY KEY,
    filename    TEXT        UNIQUE NOT NULL,
    applied_at  TIMESTAMPTZ DEFAULT NOW()
  )
`;

export interface MigrationResult {
  applied: number;
  pending: number;
}

/**
 * Run outstanding migrations using the supplied pool.
 *
 * @param pool  - pg Pool connected to the target database.
 * @param dir   - directory containing *.sql migration files (defaults to
 *                MIGRATIONS_DIR so production code needs no argument).
 * @returns     MigrationResult with counts of applied and still-pending files.
 * @throws      Re-throws any DB error after rolling back the failed migration.
 */
export async function runMigrations(
  pool: Pool,
  dir: string = MIGRATIONS_DIR
): Promise<MigrationResult> {
  const client: PoolClient = await pool.connect();

  try {
    // Step 0 — take an exclusive advisory lock so that concurrent ECS instances
    // serialise here; the second instance will block until the first commits,
    // then find all migrations already applied and exit cleanly.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('nightingale_schema_migrations'))"
    );

    // Step 1 — ensure the tracking table exists (idempotent DDL)
    await client.query(CREATE_TRACKING_TABLE);

    // Step 2 — discover migration files sorted by name
    if (!fs.existsSync(dir)) {
      throw new Error(`Migrations directory not found: ${dir}`);
    }
    const allFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Step 3 — find which filenames are already applied
    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations"
    );
    const appliedSet = new Set(rows.map((r) => r.filename));

    const pendingFiles = allFiles.filter((f) => !appliedSet.has(f));

    // Step 4 — apply each pending migration in its own transaction
    let appliedCount = 0;
    for (const file of pendingFiles) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        appliedCount++;
        logger.info({ migration: file }, "Migration applied");
      } catch (err) {
        await client.query("ROLLBACK");
        logger.error({ migration: file, err }, "Migration failed — rolled back");
        throw err;
      }
    }

    const result: MigrationResult = {
      applied: appliedCount,
      pending: pendingFiles.length - appliedCount,
    };

    if (appliedCount > 0) {
      logger.info(result, "Migrations complete");
    } else {
      logger.info("No pending migrations");
    }

    return result;
  } finally {
    client.release();
  }
}

/**
 * Module-level cache so /health can return the last known counts without
 * hitting the DB on every request.
 */
let _lastResult: MigrationResult | null = null;

export function setMigrationResult(r: MigrationResult): void {
  _lastResult = r;
}

export function getMigrationResult(): MigrationResult | null {
  return _lastResult;
}
