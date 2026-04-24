// ---------------------------------------------------------------------------
// User-facing error copy — never expose technical jargon
// ---------------------------------------------------------------------------

export function getErrorMessage(status: number): { title: string; detail: string } {
  switch (status) {
    case 400:
      return {
        title: "Something doesn't look right",
        detail: "Please check your input and try again.",
      };
    case 401:
      return {
        title: "You've been signed out",
        detail: "Please sign in again to continue.",
      };
    case 403:
      return {
        title: "Access denied",
        detail: "You don't have permission to do this.",
      };
    case 404:
      return {
        title: "Not found",
        detail: "This item no longer exists or may have been removed.",
      };
    case 409:
      return {
        title: "Already submitted",
        detail: "This action has already been completed.",
      };
    case 429:
      return {
        title: "Too many requests",
        detail: "Please wait a moment before trying again.",
      };
    case 500:
      return {
        title: "Something went wrong on our end",
        detail: "Our team has been notified. Please try again in a few minutes.",
      };
    case 503:
      return {
        title: "Service temporarily unavailable",
        detail: "We're experiencing high demand. Please try again shortly.",
      };
    default:
      return {
        title: "Something went wrong",
        detail: "Please try again.",
      };
  }
}

// ---------------------------------------------------------------------------
// Fire-and-forget client error reporter
// ---------------------------------------------------------------------------

export function reportClientError(
  errorCode: string,
  errorMessage: string,
  correlationId?: string,
  page?: string
): void {
  fetch("/api/v1/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      errorCode,
      errorMessage: errorMessage.slice(0, 500),
      correlationId,
      page,
    }),
  }).catch(() => {}); // fire-and-forget, never throw
}
