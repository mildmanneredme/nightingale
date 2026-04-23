import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  getConsultations: vi.fn(),
  setToken: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ token: "tok", setToken: vi.fn() }),
}));

import { getConsultations } from "@/lib/api";
import DashboardPage from "@/app/(patient)/dashboard/page";

beforeEach(() => vi.clearAllMocks());

describe("DashboardPage", () => {
  it("shows empty state when no consultations", async () => {
    (getConsultations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    render(<DashboardPage />);
    await waitFor(() =>
      expect(screen.getByText(/no consultations/i)).toBeInTheDocument()
    );
  });

  it("renders a consultation row for each consultation", async () => {
    (getConsultations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "c1", status: "pending", consultationType: "voice", presentingComplaint: "sore throat", createdAt: new Date().toISOString() },
      { id: "c2", status: "transcript_ready", consultationType: "voice", presentingComplaint: "back pain", createdAt: new Date().toISOString() },
    ]);
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/sore throat/i)).toBeInTheDocument());
    expect(screen.getByText(/back pain/i)).toBeInTheDocument();
  });

  it("renders a Start Consultation CTA", async () => {
    (getConsultations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    render(<DashboardPage />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /start a consultation/i })).toBeInTheDocument()
    );
  });
});
