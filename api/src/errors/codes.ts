/**
 * Centralised error code constants — format: DOMAIN_OPERATION_REASON.
 *
 * Use these for structured logging (`errorCode` field on Pino log lines) and
 * for the `code` property on thrown errors that propagate to errorHandler.
 *
 * NOTE: these are *log/observability* codes, not the wire-format `event_type`
 * values stored in `audit_log` (those are historical and must not be renamed).
 */

// AUTH — JWT verification, role gating, and bearer-token presence.
/** Authorization header missing or not in `Bearer <token>` form. */
export const AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING";
/** Cognito JWT failed signature/expiry/issuer verification. */
export const AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID";
/** Authenticated user lacks the required Cognito group/role for this route. */
export const AUTH_ROLE_FORBIDDEN = "AUTH_ROLE_FORBIDDEN";

// DB — Postgres pool / query lifecycle.
/** A query exceeded the SLOW_QUERY_THRESHOLD_MS budget. */
export const DB_QUERY_SLOW = "DB_QUERY_SLOW";
/** A query threw an unexpected error from the pg driver. */
export const DB_QUERY_FAILED = "DB_QUERY_FAILED";

// VALIDATION — request shape / Zod schema rejections.
/** Request body failed Zod schema validation. */
export const VALIDATION_BODY_INVALID = "VALIDATION_BODY_INVALID";
/** Request query parameters were missing or malformed. */
export const VALIDATION_QUERY_INVALID = "VALIDATION_QUERY_INVALID";

// RATE_LIMIT — express-rate-limit responses.
/** Caller exceeded the per-IP or per-user request budget. */
export const RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED";

// RESOURCE — generic 404 / not-found surface.
/** A referenced patient/consultation/doctor row was not found. */
export const RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND";
/** Caller attempted to mutate a resource not owned by them. */
export const RESOURCE_FORBIDDEN = "RESOURCE_FORBIDDEN";

// INTERNAL — unhandled / unclassified failures.
/** errorHandler fallback when a thrown error has no .code attached. */
export const INTERNAL_UNHANDLED = "INTERNAL_UNHANDLED";
