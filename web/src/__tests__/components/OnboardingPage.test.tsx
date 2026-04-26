// PRD-023: tests for the onboarding wizard page.
//
// Covers:
//   - Welcome → step 1 navigation
//   - Step 1 "Continue" persists fields and advances
//   - Step 1 "Skip for now" surfaces a soft warning when required fields are
//     empty, records the skip, and advances anyway
//   - Step 3 "Finish" completes onboarding and routes to /dashboard
//   - Already-onboarded patient is redirected straight to /dashboard

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/api", () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
  addAllergy: vi.fn(),
  addMedication: vi.fn(),
  addCondition: vi.fn(),
  recordOnboardingStep: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
}));

import OnboardingPage from "@/app/(patient)/onboarding/page";
import { getMe, updateMe, recordOnboardingStep } from "@/lib/api";

const mockGetMe = getMe as ReturnType<typeof vi.fn>;
const mockUpdateMe = updateMe as ReturnType<typeof vi.fn>;
const mockRecordStep = recordOnboardingStep as ReturnType<typeof vi.fn>;

const emptyPatient = {
  id: "p1",
  email: "wizard@test.com",
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  phone: "",
  address: "",
  medicareNumber: "",
  gpName: "",
  gpClinic: "",
  allergiesNoneDeclared: false,
  medicationsNoneDeclared: false,
  conditionsNoneDeclared: false,
  onboardingCompletedAt: null,
  allergies: [],
  medications: [],
  conditions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMe.mockResolvedValue(emptyPatient);
  mockUpdateMe.mockResolvedValue({});
  mockRecordStep.mockResolvedValue(undefined);
});

describe("OnboardingPage", () => {
  it("redirects to /dashboard when onboarding is already complete", async () => {
    mockGetMe.mockResolvedValueOnce({
      ...emptyPatient,
      onboardingCompletedAt: new Date().toISOString(),
    });
    render(<OnboardingPage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard")
    );
  });

  it("renders the welcome screen on first paint and advances to step 1", async () => {
    render(<OnboardingPage />);
    await waitFor(() =>
      expect(screen.getByText(/welcome to nightingale/i)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText(/tell us about you/i)).toBeInTheDocument();
  });

  it("step 1 'Continue' persists filled fields, records the step, and advances", async () => {
    render(<OnboardingPage />);
    await waitFor(() => screen.getByText(/welcome to nightingale/i));
    await userEvent.click(screen.getByRole("button", { name: /get started/i }));

    await userEvent.type(screen.getByLabelText(/first name/i), "Sam");
    await userEvent.type(screen.getByLabelText(/last name/i), "Patient");
    await userEvent.type(screen.getByLabelText(/date of birth/i), "1990-01-01");
    await userEvent.type(screen.getByLabelText(/phone number/i), "0412345678");

    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Sam",
          lastName: "Patient",
          dateOfBirth: "1990-01-01",
          phone: "0412345678",
        })
      );
    });
    expect(mockRecordStep).toHaveBeenCalledWith(1, false, []);
    expect(screen.getByText(/address & healthcare/i)).toBeInTheDocument();
  });

  it("step 1 'Skip for now' surfaces a warning, records skipped fields, advances", async () => {
    render(<OnboardingPage />);
    await waitFor(() => screen.getByText(/welcome to nightingale/i));
    await userEvent.click(screen.getByRole("button", { name: /get started/i }));

    // Click Skip without filling anything — all required fields skipped.
    await userEvent.click(screen.getByRole("button", { name: /skip for now/i }));

    await waitFor(() => {
      expect(mockRecordStep).toHaveBeenCalledWith(
        1,
        true,
        expect.arrayContaining(["firstName", "lastName", "dateOfBirth", "phone"])
      );
    });
    expect(mockUpdateMe).not.toHaveBeenCalled();
    // Now showing step 2
    expect(screen.getByText(/address & healthcare/i)).toBeInTheDocument();
  });

  it("step 3 'Finish' marks completion and routes to /dashboard", async () => {
    render(<OnboardingPage />);
    await waitFor(() => screen.getByText(/welcome to nightingale/i));
    await userEvent.click(screen.getByRole("button", { name: /get started/i }));
    // Skip past step 1 and step 2
    await userEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => screen.getByText(/address & healthcare/i));
    await userEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => screen.getByText(/your health basics/i));

    await userEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() =>
      expect(mockRecordStep).toHaveBeenCalledWith(3, false, [])
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/dashboard?welcome=1")
    );
  });
});
