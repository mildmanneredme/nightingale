import { ErrorRequestHandler } from "express";
import { logger } from "../logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const errorCode: string = (err as any).code ?? "INTERNAL.UNHANDLED";
  const httpStatus: number = (err as any).status ?? err.status ?? 500;
  logger.error(
    {
      errorCode,
      correlationId: (req as any).correlationId,
      operation: `${req.method} ${req.route?.path ?? req.path}`,
      userId: (req as any).user?.sub ?? null,
      httpStatus,
      err,
    },
    err.message ?? "Unhandled error"
  );
  const message =
    httpStatus < 500 ? (err.message ?? "Bad request") : "Internal server error";
  res.status(httpStatus).json({ error: message });
};
