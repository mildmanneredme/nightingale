import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  getConsultation: vi.fn(),
  setToken: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "c1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ token: "tok", setToken: vi.fn() }),
}));

import { getConsultation } from "@/lib/api";
import ResultPage from "@/app/(patient)/consultation/[id]/result/page";

beforeEach(() => vi.clearAllMocks());

describe("ResultPage", () => {
  it("shows under-review state for pending/transcript_ready status", async () => {
    (getConsultation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "c1", status: "transcript_ready", consultationType: "voice", createdAt: "",
    });
    render(<ResultPage />);
    await waitFor(() =>
      expect(screen.getByText(/under review/i)).toBeInTheDocument()
    );
  });

  it("shows emergency screen for emergency_escalated status", async () => {
    (getConsultation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "c1", status: "emergency_escalated", consultationType: "voice", createdAt: "",
    });
    render(<ResultPage />);
    await waitFor(() =>
      expect(screen.getByText(/000/)).toBeInTheDocument()
    );
  });

  it("shows cannot-assess screen for cannot_assess status", async () => {
    (getConsultation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "c1", status: "cannot_assess", consultationType: "voice", createdAt: "",
    });
    render(<ResultPage />);
    await waitFor(() =>
      expect(screen.getByText(/cannot assess remotely/i)).toBeInTheDocument()
    );
  });
});
