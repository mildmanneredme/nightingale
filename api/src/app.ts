import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import { correlationId } from "./middleware/correlationId";
import healthRouter from "./routes/health";
import clientErrorRouter from "./routes/clientError";
import patientRouter from "./routes/patients";
import consultationRouter from "./routes/consultations";
import photoRouter from "./routes/photos";
import doctorRouter from "./routes/doctor";
import doctorRegistrationRouter from "./routes/doctorRegistration";
import adminRouter from "./routes/admin";
import inboxRouter from "./routes/inbox";
import webhooksRouter from "./routes/webhooks";
import availabilityRouter from "./routes/availability";
import renewalsRouter from "./routes/renewals";
import followupRouter from "./routes/followup";
import authRouter from "./routes/auth";
import { requireAuth, requireRole } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Trust one proxy hop (the ALB) so X-Forwarded-For is used for client IP in rate limiting
app.set("trust proxy", 1);

// OPS-001: Correlation ID — must be first so every request and response has an X-Correlation-ID
app.use(correlationId);

// SEC-003: Security headers (helmet first — before any response is sent)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// SEC-003: Global rate limit — 300 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please try again later" },
});
app.use(globalLimiter);

// C-09 / F-042–F-046: Per-authenticated-user rate limiters (run after requireAuth so req.user is set).
// Write limiter: 5 POST requests/min per user.sub (clinical write operations).
// Read limiter:  60 non-POST requests/min per user.sub.
// Both limiters are instantiated once and shared across all authenticated route mounts —
// limits are therefore per-user across ALL endpoints combined.
const userWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.sub,
  skip: (req) => req.method !== "POST",
  message: { error: "Too many requests — please try again later" },
});

const userReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.sub,
  skip: (req) => req.method === "POST",
  message: { error: "Too many requests — please try again later" },
});
// NOTE: Both limiters use the default MemoryStore — limits are per-ECS-instance, not cluster-wide.

// SEC-002: Raw body required for SendGrid ECDSA signature verification.
// Must be registered BEFORE the global express.json() middleware.
app.use("/api/v1/webhooks/sendgrid", express.raw({ type: "*/*" }));
app.use(express.json());
// P-08: HTTP request/response logging — structured, level-routed, /health excluded
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/ready",
  },
  customLogLevel: (_req, res, err) => {
    // err fires on stream/socket errors; intentionally logged at error even if statusCode < 500
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} ${res.statusCode} — ${err?.message ?? "error"}`,
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        correlationId: (req.raw as { correlationId?: string }).correlationId,
        userId: (req.raw as { user?: { sub: string } }).user?.sub,
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
}));

app.use(healthRouter);
// Public auth utilities (check-email for smart login flow)
app.use("/api/v1/auth", authRouter);
// OPS-001: Client-error reporting — no auth, rate-limited internally
app.use("/api/v1/client-error", clientErrorRouter);
app.use("/api/v1/patients", requireAuth, userWriteLimiter, userReadLimiter, patientRouter);
app.use("/api/v1/consultations", requireAuth, userWriteLimiter, userReadLimiter, consultationRouter);
app.use("/api/v1/consultations", requireAuth, userWriteLimiter, userReadLimiter, photoRouter);
app.use("/api/v1/doctor", requireAuth, requireRole("doctor"), userWriteLimiter, userReadLimiter, doctorRouter);
// Doctor registration, demo requests, and admin application review (mixed auth — applied per-route internally)
app.use("/api/v1", doctorRegistrationRouter);
app.use("/api/v1/admin", requireAuth, requireRole("admin"), userWriteLimiter, userReadLimiter, adminRouter);
// Doctor schedule management
app.use("/api/v1/doctor/schedule", requireAuth, requireRole("doctor"), userWriteLimiter, userReadLimiter, availabilityRouter);
// Script renewals — patient routes (submit, list) + doctor queue + admin expiry check
app.use("/api/v1/renewals", requireAuth, userWriteLimiter, userReadLimiter, renewalsRouter);
// Patient inbox — authenticated, patient role
app.use("/api/v1/inbox", requireAuth, requireRole("patient"), userWriteLimiter, userReadLimiter, inboxRouter);
// SendGrid delivery webhooks — no auth (called by SendGrid servers)
app.use("/api/v1/webhooks", webhooksRouter);
// Post-consultation follow-up: /send (admin/scheduler), /respond/:token (public)
app.use("/api/v1/followup", followupRouter);

app.use(errorHandler);

export default app;
