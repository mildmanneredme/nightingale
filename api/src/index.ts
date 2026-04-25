import app from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { pool } from "./db";
import { wsUpgradeHandler, wss } from "./ws/upgradeHandler";
import { runMigrations, setMigrationResult } from "./db/migrations";
import { loadTemplates } from "./email-templates/loader";

async function main() {
  // F-078 / F-079: load and cache email templates; exits with code 1 if any are missing
  loadTemplates();

  // F-025: run migrations before accepting traffic; F-026: exit 1 on failure
  try {
    const result = await runMigrations(pool);
    setMigrationResult(result);
  } catch (err) {
    logger.error({ err }, "Startup migration failed — exiting with code 1");
    await pool.end().catch(() => undefined);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, "Server started");
  });

  server.on("upgrade", (req, socket, head) => {
    wsUpgradeHandler(req, socket, head).catch((err) => {
      logger.error({ err }, "Unhandled WS upgrade error");
      socket.destroy();
    });
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down");
    wss.close();
    server.close(async () => {
      await pool.end();
      logger.info("Shutdown complete");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
