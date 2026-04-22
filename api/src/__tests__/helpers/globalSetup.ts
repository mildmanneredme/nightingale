import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

// Applies all migrations to the test database before the suite runs.
// Requires TEST_DB_URL to be set, e.g.:
//   TEST_DB_URL=postgres://nightingale_admin:password@localhost:5432/nightingale_test
export default async function globalSetup() {
  const url = process.env.TEST_DB_URL;
  if (!url) {
    throw new Error(
      "TEST_DB_URL must be set to run integration tests.\n" +
        "Example: TEST_DB_URL=postgres://nightingale_admin:password@localhost:5432/nightingale_test"
    );
  }

  const pool = new Pool({ connectionString: url });
  try {
    // Ensure app_role exists — migrations grant privileges to it
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
          CREATE ROLE app_role;
        END IF;
      END $$;
    `);

    const migrationsDir = path.resolve(
      __dirname,
      "../../../../infra/database/migrations"
    );
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
}
