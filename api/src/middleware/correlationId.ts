import { randomBytes } from "crypto";
import { RequestHandler } from "express";

export const correlationId: RequestHandler = (req, res, next) => {
  const id =
    (req.headers["x-correlation-id"] as string | undefined) ??
    `req-${randomBytes(4).toString("hex")}`;
  (req as any).correlationId = id;
  res.setHeader("X-Correlation-ID", id);
  next();
};
