import { Router } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../logger";

const router = Router();

const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

const ERROR_CODE_RE = /^[A-Z_][A-Z_.]*$/;

router.post("/", clientErrorLimiter, (req, res) => {
  const { errorCode, errorMessage, page, correlationId } = req.body ?? {};

  if (typeof errorCode !== "string" || !ERROR_CODE_RE.test(errorCode)) {
    res.status(400).json({ error: "errorCode is required and must match ^[A-Z_][A-Z_.]*$" });
    return;
  }
  if (
    typeof errorMessage !== "string" ||
    errorMessage.length === 0 ||
    errorMessage.length > 500
  ) {
    res.status(400).json({ error: "errorMessage is required (max 500 chars)" });
    return;
  }

  logger.warn(
    {
      service: "nightingale-web",
      errorCode,
      errorMessage,
      page: typeof page === "string" ? page : undefined,
      correlationId: typeof correlationId === "string" ? correlationId : undefined,
    },
    "Client error reported"
  );

  res.status(204).end();
});

export default router;
