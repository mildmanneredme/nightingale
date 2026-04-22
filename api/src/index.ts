import app from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { pool } from "./db";

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, "Server started");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await pool.end();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
