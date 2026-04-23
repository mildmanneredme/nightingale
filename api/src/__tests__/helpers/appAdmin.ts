import express, { RequestHandler } from "express";
import { errorHandler } from "../../middleware/errorHandler";
import { requireRole } from "../../middleware/auth";
import adminRouter from "../../routes/admin";

export function buildAdminApp(adminCognitoSub: string): express.Application {
  const app = express();
  app.use(express.json());

  const stubAuth: RequestHandler = (req, _res, next) => {
    (req as any).user = { sub: adminCognitoSub, "cognito:groups": ["admin"] };
    next();
  };
  app.use(stubAuth);
  app.use("/api/v1/admin", requireRole("admin"), adminRouter);
  app.use(errorHandler);
  return app;
}
