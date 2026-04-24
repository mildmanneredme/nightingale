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
import { requireAuth, requireRole } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

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
// Patient inbox — authenticated, patient role
app.use("/api/v1/inbox", requireAuth, requireRole("patient"), inboxRouter);
// SendGrid delivery webhooks — no auth (called by SendGrid servers)
app.use("/api/v1/webhooks", webhooksRouter);

app.use(errorHandler);

export default app;
