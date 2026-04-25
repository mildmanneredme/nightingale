// Express Request augmentation for Nightingale API
//
// Declares the properties that auth and correlation-ID middleware attach to
// every incoming request.  TypeScript will now error at compile time if code
// reads a property that no longer exists on the request (e.g. if middleware
// renames `sub` → `userId`), preventing silent runtime crashes.

declare global {
  namespace Express {
    interface Request {
      /** Authenticated Cognito user attached by requireAuth middleware. */
      user: {
        sub: string;
        role?: string;
        email: string;
        /** Cognito user-pool groups the token was issued with. */
        "cognito:groups": string[];
        /** Allow any other JWT claim fields from the Cognito payload. */
        [claim: string]: unknown;
      };
      /** Request-scoped correlation ID attached by correlationId middleware. */
      correlationId: string;
    }
  }
}

export {};
