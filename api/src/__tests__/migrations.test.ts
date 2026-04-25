/**
 * C-05: Unit tests for the migration runner (F-023, F-026, F-028)
 *
 * All tests use a fully-mocked pg PoolClient and a mock filesystem so no
 * real database or disk access is required.
 *
 * Scenarios covered:
 *  1. Already-applied migrations are skipped (idempotency).
 *  2. New (pending) migrations are applied in alphabetical order.
 *  3. A failed migration causes a ROLLBACK and re-throws the error.
 *  4. `getMigrationResult` / `setMigrationResult` cache helpers work.
 */

// ── Mocks must be declared before imports ─────────────────────────────────
jest.mock("fs");
jest.mock("../db");          // prevent real pg Pool construction
jest.mock("../logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as fs from "fs";
import * as path from "path";
import { Pool, PoolClient } from "pg";
import {
  runMigrations,
  getMigrationResult,
  setMigrationResult,
  MigrationResult,
} from "../db/migrations";

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a mock PoolClient whose query() resolves based on the sql sent. */
function buildMockClient(opts: {
  appliedFilenames?: string[];
  failOnSql?: string;
}): PoolClient {
  const { appliedFilenames = [], failOnSql } = opts;

  const queryMock = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (typeof sql !== "string") return { rows: [] };

    const norm = sql.trim().toUpperCase();

    // Tracking table creation — always succeeds
    if (norm.startsWith("CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS")) {
      return { rows: [] };
    }

    // Return already-applied filenames
    if (norm.startsWith("SELECT FILENAME FROM SCHEMA_MIGRATIONS")) {
      return { rows: appliedFilenames.map((f) => ({ filename: f })) };
    }

    // Transaction control
    if (norm === "BEGIN" || norm === "COMMIT" || norm === "ROLLBACK") {
      return { rows: [] };
    }

    // Insert tracking row — always succeeds
    if (norm.startsWith("INSERT INTO SCHEMA_MIGRATIONS")) {
      return { rows: [] };
    }

    // Simulate a failing migration SQL
    if (failOnSql && sql.includes(failOnSql)) {
      throw new Error(`Simulated migration error: ${failOnSql}`);
    }

    // Generic SQL (migration body) — succeeds
    return { rows: [] };
  });

  return {
    query: queryMock,
    release: jest.fn(),
  } as unknown as PoolClient;
}

/** Build a mock Pool that returns the given PoolClient. */
function buildMockPool(client: PoolClient): Pool {
  return {
    connect: jest.fn().mockResolvedValue(client),
  } as unknown as Pool;
}

/** Set up fs mocks for a given list of filenames in a fake directory. */
function mockFs(files: Record<string, string>, dir: string) {
  (fs.existsSync as jest.Mock).mockImplementation((p: unknown) => p === dir);
  (fs.readdirSync as jest.Mock).mockImplementation((p: unknown) => {
    if (p === dir) return Object.keys(files);
    return [];
  });
  (fs.readFileSync as jest.Mock).mockImplementation((p: unknown, _enc: unknown) => {
    const file = path.basename(p as string);
    if (file in files) return files[file];
    throw new Error(`File not found: ${p}`);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

const FAKE_DIR = "/fake/migrations";

describe("runMigrations", () => {
  afterEach(() => jest.clearAllMocks());

  it("skips already-applied migrations and returns applied=0, pending=0", async () => {
    const files = {
      "001_init.sql": "CREATE TABLE foo (id INT);",
      "002_add_col.sql": "ALTER TABLE foo ADD COLUMN bar TEXT;",
    };
    mockFs(files, FAKE_DIR);

    const client = buildMockClient({
      appliedFilenames: ["001_init.sql", "002_add_col.sql"],
    });
    const pool = buildMockPool(client);

    const result = await runMigrations(pool, FAKE_DIR);

    expect(result).toEqual({ applied: 0, pending: 0 });

    // BEGIN/COMMIT should never have been called (nothing to run)
    const calls = (client.query as jest.Mock).mock.calls.map(
      ([sql]: [string]) => sql.trim().toUpperCase()
    );
    expect(calls).not.toContain("BEGIN");
    expect(calls).not.toContain("COMMIT");

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("applies pending migrations in alphabetical order", async () => {
    const files = {
      "001_init.sql": "CREATE TABLE foo (id INT);",
      "002_add_col.sql": "ALTER TABLE foo ADD COLUMN bar TEXT;",
      "003_index.sql": "CREATE INDEX idx_foo ON foo (id);",
    };
    mockFs(files, FAKE_DIR);

    // Only 001 is already applied
    const client = buildMockClient({ appliedFilenames: ["001_init.sql"] });
    const pool = buildMockPool(client);

    const result = await runMigrations(pool, FAKE_DIR);

    expect(result).toEqual({ applied: 2, pending: 0 });

    const queryCalls = (client.query as jest.Mock).mock.calls.map(
      ([sql]: [string]) => sql.trim()
    );

    // Both 002 and 003 SQL bodies should have been executed
    expect(queryCalls).toContain("ALTER TABLE foo ADD COLUMN bar TEXT;");
    expect(queryCalls).toContain("CREATE INDEX idx_foo ON foo (id);");

    // Should have had 2 BEGIN/COMMIT pairs
    const beginCount = queryCalls.filter((s) => s.toUpperCase() === "BEGIN").length;
    expect(beginCount).toBe(2);

    // 002 must have been applied before 003 (alphabetical order enforced).
    // Match on unique substrings from each migration's SQL body.
    const idx002 = queryCalls.findIndex((q) => q.includes("ADD COLUMN bar"));
    const idx003 = queryCalls.findIndex((q) => q.includes("idx_foo"));
    expect(idx002).toBeGreaterThanOrEqual(0);
    expect(idx003).toBeGreaterThanOrEqual(0);
    expect(idx002).toBeLessThan(idx003);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("applies all migrations when none have been applied yet", async () => {
    const files = {
      "001_init.sql": "CREATE TABLE foo (id INT);",
      "002_add_col.sql": "ALTER TABLE foo ADD COLUMN bar TEXT;",
    };
    mockFs(files, FAKE_DIR);

    const client = buildMockClient({ appliedFilenames: [] });
    const pool = buildMockPool(client);

    const result = await runMigrations(pool, FAKE_DIR);

    expect(result).toEqual({ applied: 2, pending: 0 });
  });

  it("rolls back on failure and re-throws the error", async () => {
    const FAIL_MARKER = "BREAK_THIS_MIGRATION";
    const files = {
      "001_ok.sql": "CREATE TABLE good (id INT);",
      "002_bad.sql": `ALTER TABLE good ADD COLUMN ${FAIL_MARKER} TEXT;`,
    };
    mockFs(files, FAKE_DIR);

    const client = buildMockClient({ failOnSql: FAIL_MARKER });
    const pool = buildMockPool(client);

    await expect(runMigrations(pool, FAKE_DIR)).rejects.toThrow(
      `Simulated migration error: ${FAIL_MARKER}`
    );

    const queryCalls = (client.query as jest.Mock).mock.calls.map(
      ([sql]: [string]) => sql.trim().toUpperCase()
    );

    // A ROLLBACK must have been issued
    expect(queryCalls).toContain("ROLLBACK");

    // COMMIT must NOT have been issued after the failure
    // (There should be exactly 1 COMMIT — for the successful 001 migration)
    const commitCount = queryCalls.filter((s) => s === "COMMIT").length;
    expect(commitCount).toBe(1); // only 001 committed

    // Client must still be released
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — running twice with same applied set returns applied=0 both times", async () => {
    const files = {
      "001_init.sql": "CREATE TABLE foo (id INT);",
    };
    mockFs(files, FAKE_DIR);

    // First run: nothing applied yet
    const client1 = buildMockClient({ appliedFilenames: [] });
    const pool1 = buildMockPool(client1);
    const first = await runMigrations(pool1, FAKE_DIR);
    expect(first).toEqual({ applied: 1, pending: 0 });

    // Second run: simulate that 001 is now applied
    const client2 = buildMockClient({ appliedFilenames: ["001_init.sql"] });
    const pool2 = buildMockPool(client2);
    const second = await runMigrations(pool2, FAKE_DIR);
    expect(second).toEqual({ applied: 0, pending: 0 });
  });
});

// ── Cache helpers ─────────────────────────────────────────────────────────

describe("getMigrationResult / setMigrationResult", () => {
  it("returns null before any result is set", () => {
    // Reset the module-level cache by re-requiring with jest.isolateModules
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("../db/migrations");
      expect(mod.getMigrationResult()).toBeNull();
    });
  });

  it("returns the value after setMigrationResult is called", () => {
    const r: MigrationResult = { applied: 5, pending: 0 };
    setMigrationResult(r);
    expect(getMigrationResult()).toEqual(r);
    // Clean up for other tests
    setMigrationResult({ applied: 0, pending: 0 });
  });
});
