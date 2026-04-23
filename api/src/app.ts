import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import healthRouter from "./routes/health";
import patientRouter from "./routes/patients";
import consultationRouter from "./routes/consultations";
import doctorRouter from "./routes/doctor";
import adminRouter from "./routes/admin";
import { requireAuth, requireRole } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use(healthRouter);
app.use("/api/v1/patients", requireAuth, patientRouter);
app.use("/api/v1/consultations", requireAuth, consultationRouter);
app.use("/api/v1/doctor", requireAuth, requireRole("doctor"), doctorRouter);
app.use("/api/v1/admin", requireAuth, requireRole("admin"), adminRouter);

app.use(errorHandler);

export default app;
