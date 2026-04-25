import express, { RequestHandler } from "express";
import { errorHandler } from "../../middleware/errorHandler";
import { requireRole } from "../../middleware/auth";
import doctorRouter from "../../routes/doctor";

export function buildDoctorApp(doctorCognitoSub: string): express.Application {
  const app = express();
  app.use(express.json());

  const stubAuth: RequestHandler = (req, _res, next) => {
    req.user = { sub: doctorCognitoSub, "cognito:groups": ["doctor"], role: "doctor", email: "" };
    next();
  };
  app.use(stubAuth);
  app.use("/api/v1/doctor", requireRole("doctor"), doctorRouter);
  app.use(errorHandler);
  return app;
}
