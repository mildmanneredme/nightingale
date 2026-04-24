import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import healthRouter from "./routes/health";
import patientRouter from "./routes/patients";
import consultationRouter from "./routes/consultations";
import photoRouter from "./routes/photos";
import doctorRouter from "./routes/doctor";
import adminRouter from "./routes/admin";
import inboxRouter from "./routes/inbox";
import webhooksRouter from "./routes/webhooks";
import availabilityRouter from "./routes/availability";
import renewalsRouter from "./routes/renewals";
import followupRouter from "./routes/followup";
import { requireAuth, requireRole } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// SEC-002: Raw body required for SendGrid ECDSA signature verification.
// Must be registered BEFORE the global express.json() middleware.
app.use("/api/v1/webhooks/sendgrid", express.raw({ type: "*/*" }));
app.use(express.json());
app.use(pinoHttp({ logger }));

app.use(healthRouter);
app.use("/api/v1/patients", requireAuth, patientRouter);
app.use("/api/v1/consultations", requireAuth, consultationRouter);
app.use("/api/v1/consultations", requireAuth, photoRouter);
app.use("/api/v1/doctor", requireAuth, requireRole("doctor"), doctorRouter);
app.use("/api/v1/admin", requireAuth, requireRole("admin"), adminRouter);
// Doctor schedule management
app.use("/api/v1/doctor/schedule", requireAuth, requireRole("doctor"), availabilityRouter);
// Script renewals — patient routes (submit, list) + doctor queue + admin expiry check
app.use("/api/v1/renewals", requireAuth, renewalsRouter);
// Patient inbox — authenticated, patient role
app.use("/api/v1/inbox", requireAuth, requireRole("patient"), inboxRouter);
// SendGrid delivery webhooks — no auth (called by SendGrid servers)
app.use("/api/v1/webhooks", webhooksRouter);
// Post-consultation follow-up: /send (admin/scheduler), /respond/:token (public)
app.use("/api/v1/followup", followupRouter);

app.use(errorHandler);

export default app;
