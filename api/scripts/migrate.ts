import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    database: process.env.DB_NAME ?? "nightingale",
    user: process.env.DB_USER ?? "nightingale_admin",
    password: process.env.DB_PASSWORD,
    ssl: process.env.APP_ENV !== "development" ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Ensure app_role exists — migrations grant privileges to it
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
          CREATE ROLE app_role;
        END IF;
      END $$;
    `);

    const migrationsDir = path.resolve(__dirname, "../../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows: applied } = await pool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    for (const file of pending) {
      console.log(`Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await pool.query("COMMIT");
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await pool.query("ROLLBACK");
        console.error(`  ✗ ${file} failed:`, err);
        process.exit(1);
      }
    }

    console.log(`Applied ${pending.length} migration(s) successfully.`);
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
