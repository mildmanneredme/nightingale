import app from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { pool } from "./db";
import { wsUpgradeHandler, wss } from "./ws/upgradeHandler";

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
