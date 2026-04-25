import { RequestHandler } from "express";
import { ZodSchema } from "zod";

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure: 400 with structured error array.
 * On success: calls next().
 *
 * Error shape: { error: "Validation failed", details: [{ field: string, message: string }] }
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.length ? issue.path.join(".") : "body",
        message: issue.message,
      }));
      res.status(400).json({ error: "Validation failed", details });
      return;
    }
    req.body = result.data;
    next();
  };
}
