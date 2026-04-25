import { ErrorRequestHandler } from "express";
import { INTERNAL_UNHANDLED } from "../errors/codes";
import { logger } from "../logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const errorCode: string = (err as any).code ?? INTERNAL_UNHANDLED;
  // Only trust .httpStatus (our own errors) — never blindly propagate .status
  // from upstream SDKs (e.g. Gemini 404 for invalid model leaking to clients).
  const httpStatus: number = (err as any).httpStatus ?? 500;
  logger.error(
    {
      errorCode,
      correlationId: req.correlationId,
      operation: `${req.method} ${req.route?.path ?? req.path}`,
      userId: req.user?.sub ?? null,
      httpStatus,
      err,
    },
    err.message ?? "Unhandled error"
  );
  const message =
    httpStatus < 500 ? (err.message ?? "Bad request") : "Internal server error";
  res.status(httpStatus).json({ error: message });
};
