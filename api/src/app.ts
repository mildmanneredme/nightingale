import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import healthRouter from "./routes/health";
import patientRouter from "./routes/patients";
import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use(healthRouter);
app.use("/api/v1/patients", requireAuth, patientRouter);

app.use(errorHandler);

export default app;
