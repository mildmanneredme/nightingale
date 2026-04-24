import express, { RequestHandler } from "express";
import { errorHandler } from "../../middleware/errorHandler";
import patientRouter from "../../routes/patients";
import consultationRouter from "../../routes/consultations";
import photoRouter from "../../routes/photos";
import doctorRouter from "../../routes/doctor";
import inboxRouter from "../../routes/inbox";
import webhooksRouter from "../../routes/webhooks";

// Builds a test app with auth stubbed to a caller-supplied Cognito sub.
// This avoids any real Cognito calls in tests while exercising every other
// layer (validation, DB, error handling) with real code.
export function buildTestApp(
  cognitoSub: string,
  role: "patient" | "doctor" | "admin" = "patient"
): express.Application {
  const app = express();
  app.use(express.json());

  const stubAuth: RequestHandler = (req, _res, next) => {
    (req as any).user = { sub: cognitoSub, "cognito:groups": [role] };
    next();
  };
  app.use(stubAuth);
  app.use("/api/v1/patients", patientRouter);
  app.use("/api/v1/consultations", consultationRouter);
  app.use("/api/v1/consultations", photoRouter);
  app.use("/api/v1/doctor", doctorRouter);
  app.use("/api/v1/inbox", inboxRouter);
  app.use("/api/v1/webhooks", webhooksRouter);
  app.use(errorHandler);
  return app;
}
