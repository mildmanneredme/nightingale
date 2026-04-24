import { Pool, QueryResult, QueryResultRow } from "pg";
import { config } from "./config";
import { logger } from "./logger";

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? "500", 10);

export interface QueryContext {
  feature?: string;
  correlationId?: string;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
  ctx?: QueryContext
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, values);
    const durationMs = Date.now() - start;
    if (durationMs > SLOW_QUERY_MS) {
      logger.warn(
        {
          errorCode: "DB.QUERY.SLOW",
          feature: ctx?.feature,
          correlationId: ctx?.correlationId,
          durationMs,
          query: text.slice(0, 200),
        },
        "Slow DB query detected"
      );
    }
    return result;
  } catch (err) {
    logger.error(
      {
        errorCode: "DB.QUERY.FAILED",
        feature: ctx?.feature,
        correlationId: ctx?.correlationId,
        query: text.slice(0, 200),
        err,
      },
      "DB query failed"
    );
    throw err;
  }
}

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
