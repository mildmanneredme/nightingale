import { IncomingMessage } from "http";
import { Duplex } from "stream";
import { WebSocketServer } from "ws";
import { URL } from "url";
import crypto from "crypto";
import { logger } from "../logger";
import { pool } from "../db";
import { verifyJwt } from "../middleware/auth";
import { attachConsultationStream } from "../routes/consultations";

// WebSocket upgrade handler for /api/v1/consultations/:id/stream
// SEC-004: Validates single-use ws_token before allowing stream access.
// C-02: Cognito JWT validated on every WS upgrade before DB token lookup.
export const wss = new WebSocketServer({ noServer: true });

export async function wsUpgradeHandler(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): Promise<void> {
  // Step 1: Extract correlationId from header or generate one
  const correlationId =
    (req.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

  const url = req.url ?? "";
  const match = url.match(/^\/api\/v1\/consultations\/([^/?]+)\/stream(\?.*)?$/);
  if (!match) {
    socket.destroy();
    return;
  }

  // Step 2: Extract and verify Cognito JWT (F-007, F-008, F-009)
  // Browser WebSocket API cannot send custom headers, so the JWT is accepted
  // from the ?auth= query param when the Authorization header is absent.
  const qs = new URL(url, "http://localhost").searchParams;
  const authHeader = req.headers.authorization;
  const rawJwt = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (qs.get("auth") ?? undefined);

  if (!rawJwt) {
    logger.warn({ correlationId }, "WS upgrade rejected: missing JWT");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  let jwtSub: string;
  try {
    const payload = await verifyJwt(rawJwt);
    jwtSub = payload.sub;
  } catch (err) {
    logger.warn({ correlationId, err }, "WS upgrade rejected: invalid or expired JWT");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Step 3: Extract consultationId and ws_token from URL
  const consultationId = match[1];
  const token = qs.get("token");

  if (!token) {
    logger.warn({ correlationId, consultationId }, "WS upgrade rejected: missing token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Steps 4-6: Validate DB token, check sub, mark used — all in one try block
  try {
    // Step 4: Query DB for the WS token record, joining patients to get cognito_sub
    const { rows } = await pool.query<{ id: string; used_at: Date | null; cognito_sub: string }>(
      `SELECT wt.id, wt.used_at, p.cognito_sub
       FROM ws_tokens wt
       JOIN patients p ON p.id = wt.patient_id
       WHERE wt.token = $1
         AND wt.consultation_id = $2
         AND wt.expires_at > NOW()`,
      [token, consultationId]
    );

    if (!rows[0]) {
      logger.warn({ correlationId, consultationId }, "WS upgrade rejected: invalid or expired token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    if (rows[0].used_at) {
      logger.warn({ correlationId, consultationId }, "WS upgrade rejected: token already used");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Step 5: Verify JWT sub matches the patient's cognito_sub (F-010)
    if (jwtSub !== rows[0].cognito_sub) {
      logger.warn(
        { correlationId, consultationId, jwtSub },
        "WS upgrade rejected: JWT sub does not match consultation patient"
      );
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // Step 6: Mark token as used — single-use enforcement (only after all checks pass)
    await pool.query(
      `UPDATE ws_tokens SET used_at = NOW() WHERE id = $1`,
      [rows[0].id]
    );
  } catch (err) {
    logger.error({ err, correlationId, consultationId }, "WS token validation failed");
    socket.destroy();
    return;
  }

  // Step 7: Proceed with the upgrade
  wss.handleUpgrade(req, socket, head, (ws) => {
    attachConsultationStream(consultationId, ws);
  });
}
