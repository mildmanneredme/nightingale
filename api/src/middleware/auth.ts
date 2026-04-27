import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CognitoJwtPayload } from "aws-jwt-verify/jwt-model";
import { RequestHandler } from "express";
import { config } from "../config";
import {
  AUTH_ROLE_FORBIDDEN,
  AUTH_TOKEN_INVALID,
  AUTH_TOKEN_MISSING,
} from "../errors/codes";
import { logger } from "../logger";
import { findDoctorBySub, insertAuditLog } from "../repositories/doctor.repository";

// Lazily instantiated — verifier is only created if Cognito vars are configured.
// Routes that require auth call requireAuth(); unauthenticated routes skip it.
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    if (!config.cognito.userPoolId || !config.cognito.clientId) {
      throw new Error("COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set");
    }
    verifier = CognitoJwtVerifier.create({
      userPoolId: config.cognito.userPoolId,
      tokenUse: "access",
      clientId: config.cognito.clientId,
    });
  }
  return verifier;
}

/**
 * Verifies a raw Cognito JWT string and returns the decoded payload.
 * Throws if the token is missing, invalid, or expired.
 * Used by both the HTTP middleware (requireAuth) and the WS upgrade handler (C-02).
 */
export async function verifyJwt(token: string): Promise<CognitoJwtPayload> {
  return getVerifier().verify(token);
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    const groups: string[] = req.user?.["cognito:groups"] ?? [];
    if (!roles.some((r) => groups.includes(r))) {
      logger.warn(
        {
          errorCode: AUTH_ROLE_FORBIDDEN,
          required: roles,
          actual: groups,
          userId: req.user?.sub ?? null,
        },
        "Role gate rejected request"
      );
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

// PRD-025: gate that enforces doctor status='approved' on action endpoints.
// Fails closed — a missing doctors row is treated as pending (not approved).
export const requireApprovedDoctor: RequestHandler = async (req, res, next) => {
  const sub = req.user?.sub;
  if (!sub) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const doctor = await findDoctorBySub(sub);
    if (!doctor || doctor.status !== "approved") {
      await insertAuditLog({
        eventType: "doctor.action_blocked_pending",
        actorId: sub,
        ahpraNumber: doctor?.ahpra_number ?? "unknown",
        metadata: { attempted_route: req.path, status: doctor?.status ?? "not_found" },
      });
      res.status(403).json({ error: "Verification pending", code: "DOCTOR_NOT_APPROVED" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    logger.warn(
      { errorCode: AUTH_TOKEN_MISSING },
      "Bearer token missing from Authorization header"
    );
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = await verifyJwt(token);
    // Attach claims to request for downstream use
    req.user = payload as unknown as Express.Request["user"];
    next();
  } catch (err) {
    logger.warn({ errorCode: AUTH_TOKEN_INVALID, err }, "JWT verification failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
