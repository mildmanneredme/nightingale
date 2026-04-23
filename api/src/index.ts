import { WebSocketServer } from "ws";
import app from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { pool } from "./db";
import { attachConsultationStream } from "./routes/consultations";

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, "Server started");
});

// WebSocket upgrade for /api/v1/consultations/:id/stream
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = req.url ?? "";
  const match = url.match(/^\/api\/v1\/consultations\/([^/]+)\/stream$/);
  if (!match) {
    socket.destroy();
    return;
  }
  const consultationId = match[1];
  wss.handleUpgrade(req, socket, head, (ws) => {
    attachConsultationStream(consultationId, ws);
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
