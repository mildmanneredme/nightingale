// C-02: WebSocket upgrade JWT authentication tests
//
// Covers the four acceptance criteria:
//   1. WS upgrade with no Authorization header → 401, DB token unused
//   2. WS upgrade with expired/invalid JWT    → 401, DB token unused
//   3. WS upgrade with valid JWT but wrong sub → 403, DB token unused
//   4. Valid JWT + valid token                → upgrade succeeds

import http from "http";
import net from "net";
import crypto from "crypto";
import { WebSocketServer } from "ws";
import { URL } from "url";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any module import that uses them
// ---------------------------------------------------------------------------

jest.mock("../db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("../middleware/auth", () => ({
  // requireAuth is used by app.ts routes; keep a no-op stub
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyJwt: jest.fn(),
}));

jest.mock("../routes/consultations", () => ({
  // attachConsultationStream is called only on successful upgrade
  attachConsultationStream: jest.fn(),
  default: require("express").Router(),
}));

const mockPoolQuery = jest.requireMock("../db").pool.query as jest.Mock;
const mockVerifyJwt = jest.requireMock("../middleware/auth").verifyJwt as jest.Mock;
const mockAttach = jest.requireMock("../routes/consultations")
  .attachConsultationStream as jest.Mock;

// ---------------------------------------------------------------------------
// Minimal upgrade handler (mirrors the logic in index.ts) so we can unit-test
// it without starting the full Express server or importing index.ts (which has
// a side-effect of calling app.listen).
// ---------------------------------------------------------------------------

import { pool } from "../db";
import { verifyJwt } from "../middleware/auth";
import { attachConsultationStream } from "../routes/consultations";
import { logger } from "../logger";

async function handleUpgrade(
  req: http.IncomingMessage,
  socket: net.Socket,
  head: Buffer,
  wss: WebSocketServer
): Promise<void> {
  // Step 1: correlationId
  const correlationId =
    (req.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

  const url = req.url ?? "";
  const match = url.match(/^\/api\/v1\/consultations\/([^/?]+)\/stream(\?.*)?$/);
  if (!match) {
    socket.destroy();
    return;
  }

  // Step 2: Extract and verify JWT
  const authHeader = req.headers.authorization;
  const rawJwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!rawJwt) {
    logger.warn({ correlationId }, "WS upgrade rejected: missing Authorization header");
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

  // Step 3: Extract consultationId and ws token
  const consultationId = match[1];
  const qs = new URL(url, "http://localhost").searchParams;
  const token = qs.get("token");

  if (!token) {
    logger.warn({ correlationId, consultationId }, "WS upgrade rejected: missing token");
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  // Steps 4-6: DB lookup, sub check, mark used
  try {
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

    // Step 5: sub check
    if (jwtSub !== rows[0].cognito_sub) {
      logger.warn(
        { correlationId, consultationId, jwtSub },
        "WS upgrade rejected: JWT sub does not match consultation patient"
      );
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // Step 6: mark used
    await pool.query(`UPDATE ws_tokens SET used_at = NOW() WHERE id = $1`, [rows[0].id]);
  } catch (err) {
    logger.error({ err, correlationId, consultationId }, "WS token validation failed");
    socket.destroy();
    return;
  }

  // Step 7: upgrade
  wss.handleUpgrade(req, socket, head, (ws) => {
    attachConsultationStream(consultationId, ws);
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const CONSULT_ID = "cccccccc-0000-0000-0000-000000000001";
const PATIENT_COGNITO_SUB = "c02-patient-sub-001";
const TOKEN = "valid-ws-token-abc";
const VALID_PATH = `/api/v1/consultations/${CONSULT_ID}/stream?token=${TOKEN}`;

/**
 * Sends a raw HTTP upgrade request to a local server and returns the first
 * line of the HTTP response (e.g. "HTTP/1.1 401 Unauthorized").
 */
function sendRawUpgrade(
  port: number,
  path: string,
  headers: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, "127.0.0.1", () => {
      const headerLines = Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n");
      const request =
        `GET ${path} HTTP/1.1\r\n` +
        `Host: localhost\r\n` +
        `Connection: Upgrade\r\n` +
        `Upgrade: websocket\r\n` +
        `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        (headerLines ? `${headerLines}\r\n` : "") +
        `\r\n`;
      socket.write(request);
    });

    let response = "";
    socket.on("data", (chunk) => {
      response += chunk.toString();
      // We only need the status line
      const firstLine = response.split("\r\n")[0];
      if (firstLine) {
        socket.destroy();
        resolve(firstLine);
      }
    });

    socket.on("error", () => resolve("ERROR"));
    socket.on("close", () => {
      const firstLine = response.split("\r\n")[0];
      resolve(firstLine || "CLOSED");
    });
    // Safety timeout
    setTimeout(() => {
      socket.destroy();
      const firstLine = response.split("\r\n")[0];
      resolve(firstLine || "TIMEOUT");
    }, 3000);
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("C-02: WS upgrade JWT authentication", () => {
  let server: http.Server;
  let wss: WebSocketServer;
  let port: number;

  beforeAll((done) => {
    wss = new WebSocketServer({ noServer: true });
    server = http.createServer();
    server.on("upgrade", (req, socket, head) => {
      handleUpgrade(req, socket as net.Socket, head, wss).catch(() => socket.destroy());
    });
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as net.AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    wss.close();
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: No Authorization header → 401, DB not touched
  // -------------------------------------------------------------------------
  it("rejects with 401 when Authorization header is missing; DB not queried", async () => {
    const statusLine = await sendRawUpgrade(port, VALID_PATH);

    expect(statusLine).toBe("HTTP/1.1 401 Unauthorized");
    // DB must NOT have been called — token not consumed
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-2: Expired/invalid JWT → 401, DB not touched
  // -------------------------------------------------------------------------
  it("rejects with 401 when JWT is invalid or expired; DB not queried", async () => {
    mockVerifyJwt.mockRejectedValueOnce(new Error("Token expired"));

    const statusLine = await sendRawUpgrade(port, VALID_PATH, {
      Authorization: "Bearer expired.jwt.token",
    });

    expect(statusLine).toBe("HTTP/1.1 401 Unauthorized");
    expect(mockVerifyJwt).toHaveBeenCalledWith("expired.jwt.token");
    // DB must NOT have been called — token not consumed
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC-3: Valid JWT but wrong sub → 403, DB token NOT marked used
  // -------------------------------------------------------------------------
  it("rejects with 403 when JWT sub does not match consultation patient; token not consumed", async () => {
    const wrongSub = "different-patient-sub-999";
    mockVerifyJwt.mockResolvedValueOnce({ sub: wrongSub });
    // DB lookup returns a record owned by a different patient
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: "tok-id-001", used_at: null, cognito_sub: PATIENT_COGNITO_SUB }],
    });

    const statusLine = await sendRawUpgrade(port, VALID_PATH, {
      Authorization: `Bearer valid.but.wrong.sub`,
    });

    expect(statusLine).toBe("HTTP/1.1 403 Forbidden");
    // DB was queried for the token (one call) but NOT for the UPDATE (token not consumed)
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    const selectCall = mockPoolQuery.mock.calls[0][0] as string;
    expect(selectCall).toMatch(/SELECT/i);
    // Ensure no UPDATE was issued
    expect(mockPoolQuery.mock.calls.every((c: unknown[]) => !String(c[0]).match(/UPDATE/i))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // AC-4: Valid JWT + valid token → upgrade succeeds (101 Switching Protocols)
  // -------------------------------------------------------------------------
  it("allows upgrade when JWT is valid and sub matches consultation patient", async () => {
    mockVerifyJwt.mockResolvedValueOnce({ sub: PATIENT_COGNITO_SUB });
    // SELECT returns matching row
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: "tok-id-002", used_at: null, cognito_sub: PATIENT_COGNITO_SUB }],
    });
    // UPDATE (mark used)
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    // attachConsultationStream no-op
    mockAttach.mockImplementation(() => {});

    const statusLine = await sendRawUpgrade(port, VALID_PATH, {
      Authorization: `Bearer valid.jwt.matching.sub`,
    });

    expect(statusLine).toBe("HTTP/1.1 101 Switching Protocols");
    // Both SELECT and UPDATE must have been called
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    const updateCall = mockPoolQuery.mock.calls[1][0] as string;
    expect(updateCall).toMatch(/UPDATE ws_tokens/i);
    expect(mockAttach).toHaveBeenCalledWith(CONSULT_ID, expect.anything());
  });
});
