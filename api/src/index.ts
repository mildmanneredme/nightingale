import { WebSocketServer } from "ws";
import { URL } from "url";
import app from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { pool } from "./db";
import { attachConsultationStream } from "./routes/consultations";

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, "Server started");
});

// WebSocket upgrade for /api/v1/consultations/:id/stream
// SEC-004: Validates single-use ws_token before allowing stream access.
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  const url = req.url ?? "";
  const match = url.match(/^\/api\/v1\/consultations\/([^/?]+)\/stream(\?.*)?$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const consultationId = match[1];

  // Extract token from query string
  const qs = new URL(url, "http://localhost").searchParams;
  const token = qs.get("token");

  if (!token) {
    logger.warn({ consultationId }, "WS upgrade rejected: missing token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Validate token: must exist, match this consultation, not expired, not used
  try {
    const { rows } = await pool.query<{ id: string; used_at: Date | null }>(
      `SELECT id, used_at
       FROM ws_tokens
       WHERE token = $1
         AND consultation_id = $2
         AND expires_at > NOW()`,
      [token, consultationId]
    );

    if (!rows[0]) {
      logger.warn({ consultationId }, "WS upgrade rejected: invalid or expired token");
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    if (rows[0].used_at) {
      logger.warn({ consultationId }, "WS upgrade rejected: token already used");
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // Mark token as used — single-use enforcement
    await pool.query(
      `UPDATE ws_tokens SET used_at = NOW() WHERE id = $1`,
      [rows[0].id]
    );
  } catch (err) {
    logger.error({ err, consultationId }, "WS token validation failed");
    socket.destroy();
    return;
  }

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
