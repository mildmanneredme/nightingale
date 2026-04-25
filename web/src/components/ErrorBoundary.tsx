"use client";
import React from "react";
import { ErrorState } from "@/components/ErrorState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  children: React.ReactNode;
  /** Optional override for the fallback UI. Defaults to <ErrorState />. */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// ---------------------------------------------------------------------------
// ErrorBoundary — class component (required for componentDidCatch in React 19)
// F-012: catches all errors in subtree via componentDidCatch
// F-013: renders <ErrorState /> with "Go to Dashboard" CTA
// F-014: calls POST /api/v1/client-error with error message and stack trace
// F-016: does NOT wrap the <ErrorState /> fallback itself
// ---------------------------------------------------------------------------

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // F-014: fire-and-forget POST to /api/v1/client-error
    fetch("/api/v1/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errorMessage: (error?.message ?? String(error)).slice(0, 500),
        stack: error?.stack ?? info.componentStack ?? undefined,
      }),
    }).catch(() => {}); // never throw from error boundary
  }

  render() {
    if (this.state.hasError) {
      // F-016: fallback is NOT wrapped by another ErrorBoundary
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <ErrorState
          title="Something went wrong"
          message="We could not load this page. Please try again or contact support."
          backHref="/dashboard"
          backLabel="Go to Dashboard"
        />
      );
    }

    return this.props.children;
  }
}
