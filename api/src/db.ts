import { Pool } from "pg";
import { config } from "./config";
import { logger } from "./logger";

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected pg pool error");
});

export async function checkDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
