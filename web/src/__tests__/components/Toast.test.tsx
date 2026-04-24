import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { Toast } from "@/components/Toast";
import { ToastContext, ToastItem, useToastProvider } from "@/hooks/useToast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ToastItem> = {}): ToastItem {
  return {
    id: "toast-1",
    level: "error",
    title: "Something went wrong",
    autoDismissMs: 8000,
    ...overrides,
  };
}

function renderWithToasts(toasts: ToastItem[], removeToast = vi.fn()) {
  return render(
    <ToastContext.Provider
      value={{ toasts, addToast: vi.fn(), removeToast }}
    >
      <Toast />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Toast", () => {
  it("renders nothing when no toasts", () => {
    const { container } = renderWithToasts([]);
    expect(container.firstChild).toBeNull();
  });

  it("renders a toast with title and detail", () => {
    renderWithToasts([
      makeItem({ title: "Oops", detail: "Please try again." }),
    ]);
    expect(screen.getByText("Oops")).toBeInTheDocument();
    expect(screen.getByText("Please try again.")).toBeInTheDocument();
  });

  it('shows "Reference: req-abc123" when correlationId provided', () => {
    renderWithToasts([makeItem({ correlationId: "req-abc123" })]);
    expect(screen.getByText("Reference: req-abc123")).toBeInTheDocument();
  });

  it("does not show Reference line when no correlationId", () => {
    renderWithToasts([makeItem({ correlationId: undefined })]);
    expect(screen.queryByText(/Reference:/)).toBeNull();
  });

  it("calls removeToast when × button clicked", () => {
    const removeToast = vi.fn();
    renderWithToasts([makeItem({ id: "t1" })], removeToast);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(removeToast).toHaveBeenCalledWith("t1");
  });

  it("auto-dismisses after autoDismissMs (use vi.useFakeTimers)", () => {
    vi.useFakeTimers();
    const removeToast = vi.fn();

    // We need to test the useToastProvider auto-dismiss behaviour.
    // Render using the real provider hook to exercise setTimeout.
    function Wrapper() {
      const value = useToastProvider();
      // Expose addToast via data-testid trick
      React.useEffect(() => {
        value.addToast("error", "Auto toast");
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <ToastContext.Provider value={value}>
          <Toast />
        </ToastContext.Provider>
      );
    }

    render(<Wrapper />);
    expect(screen.getByText("Auto toast")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8001);
    });

    expect(screen.queryByText("Auto toast")).toBeNull();
    vi.useRealTimers();
  });

  it("renders error variant with role=\"alert\"", () => {
    renderWithToasts([makeItem({ level: "error", title: "Error!" })]);
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });
});
