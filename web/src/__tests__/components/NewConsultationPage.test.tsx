import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("@/lib/api", () => ({
  createConsultation: vi.fn(),
  setToken: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ token: "tok", setToken: vi.fn() }),
}));

import { createConsultation } from "@/lib/api";
import NewConsultationPage from "@/app/(patient)/consultation/new/page";

beforeEach(() => vi.clearAllMocks());

describe("NewConsultationPage", () => {
  it("renders presenting complaint textarea and consultation type selector", () => {
    render(<NewConsultationPage />);
    expect(screen.getByLabelText(/what brings you in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voice/i)).toBeInTheDocument();
  });

  it("calls createConsultation on submit and redirects to audio-check", async () => {
    (createConsultation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "new-c", status: "pending", consultationType: "voice", createdAt: "" });
    render(<NewConsultationPage />);
    await userEvent.type(screen.getByLabelText(/what brings you in/i), "sore throat");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() =>
      expect(createConsultation).toHaveBeenCalledWith("voice", "sore throat")
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/consultation/new-c/audio-check")
    );
  });
});
