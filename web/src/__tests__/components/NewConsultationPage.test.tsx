import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("@/lib/api", () => ({
  createConsultation: vi.fn(),
  setToken: vi.fn(),
  ApiError: class ApiError extends Error {},
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ token: "tok", setToken: vi.fn() }),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: { error: vi.fn() } }),
}));

import { createConsultation } from "@/lib/api";
import NewConsultationPage from "@/app/(patient)/consultation/new/page";

beforeEach(() => vi.clearAllMocks());

// The presenting-complaint textarea was removed — symptom collection now happens
// during the consultation itself (refactor commit 4140783). Tests focus on the
// remaining behaviours: mode selection + submit.

describe("NewConsultationPage", () => {
  it("renders both consultation mode cards with voice selected by default", () => {
    render(<NewConsultationPage />);
    expect(screen.getByRole("button", { name: /voice call/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /text chat/i })).toBeInTheDocument();
  });

  it("calls createConsultation with the chosen mode and routes accordingly", async () => {
    (createConsultation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "new-c",
      status: "pending",
      consultationType: "voice",
      createdAt: "",
    });
    render(<NewConsultationPage />);
    await userEvent.click(screen.getByRole("button", { name: /commence consultation/i }));
    await waitFor(() => expect(createConsultation).toHaveBeenCalledWith("voice"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/consultation/new-c/audio-check")
    );
  });

  it("routes to /text when text mode is selected", async () => {
    (createConsultation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "new-c",
      status: "pending",
      consultationType: "text",
      createdAt: "",
    });
    render(<NewConsultationPage />);
    await userEvent.click(screen.getByRole("button", { name: /text chat/i }));
    await userEvent.click(screen.getByRole("button", { name: /commence consultation/i }));
    await waitFor(() => expect(createConsultation).toHaveBeenCalledWith("text"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/consultation/new-c/text")
    );
  });
});
