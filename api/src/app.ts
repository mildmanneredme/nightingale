import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use(healthRouter);

// PRD-006 patient routes — mounted here when implemented
// app.use("/api/v1/patients", patientRouter);

app.use(errorHandler);

export default app;
