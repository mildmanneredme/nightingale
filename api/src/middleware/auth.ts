import { CognitoJwtVerifier } from "aws-jwt-verify";
import { RequestHandler } from "express";
import { config } from "../config";
import { logger } from "../logger";

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

export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    const groups: string[] = req.user?.["cognito:groups"] ?? [];
    if (!roles.some((r) => groups.includes(r))) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = await getVerifier().verify(token);
    // Attach claims to request for downstream use
    req.user = payload as unknown as Express.Request["user"];
    next();
  } catch (err) {
    logger.warn({ err }, "JWT verification failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
