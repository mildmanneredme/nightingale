import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/api", () => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import ProfilePage from "@/app/(patient)/profile/page";
import { getMe, updateMe } from "@/lib/api";

const mockGetMe = getMe as ReturnType<typeof vi.fn>;
const mockUpdateMe = updateMe as ReturnType<typeof vi.fn>;

const adultPatient = {
  id: "p1",
  email: "adult@example.com",
  fullName: "Jane Smith",
  dateOfBirth: "1990-01-01",
  biologicalSex: "female",
  phone: "0412345678",
  address: "1 Test St",
  medicareNumber: "1234567890",
  isPaediatric: false,
  guardianName: null,
  guardianEmail: null,
  guardianRelationship: null,
  allergies: [],
  medications: [],
  conditions: [],
};

const minorPatient = {
  ...adultPatient,
  id: "p2",
  email: "minor@example.com",
  isPaediatric: true,
  guardianName: "Jane Parent",
  guardianEmail: "jane.parent@example.com",
  guardianRelationship: "Mother",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMe.mockResolvedValue({});
});

describe("ProfilePage — guardian section visibility", () => {
  it("does NOT show guardian section for adult patients", async () => {
    mockGetMe.mockResolvedValue(adultPatient);
    render(<ProfilePage />);
    await waitFor(() => expect(screen.queryByText(/guardian/i)).toBeNull());
  });

  it("shows guardian section for paediatric patients", async () => {
    mockGetMe.mockResolvedValue(minorPatient);
    render(<ProfilePage />);
    await waitFor(() =>
      expect(screen.getAllByText(/guardian/i).length).toBeGreaterThan(0)
    );
  });

  it("pre-populates guardian fields from patient data", async () => {
    mockGetMe.mockResolvedValue(minorPatient);
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByLabelText(/guardian name/i) as HTMLInputElement).value).toBe(
        "Jane Parent"
      );
      expect(
        (screen.getByLabelText(/guardian email/i) as HTMLInputElement).value
      ).toBe("jane.parent@example.com");
      expect(
        (screen.getByLabelText(/relationship/i) as HTMLInputElement).value
      ).toBe("Mother");
    });
  });
});

describe("ProfilePage — guardian save", () => {
  it("saves updated guardian fields and shows confirmation", async () => {
    mockGetMe.mockResolvedValue(minorPatient);
    render(<ProfilePage />);

    await waitFor(() => screen.getByLabelText(/guardian name/i));

    fireEvent.change(screen.getByLabelText(/guardian name/i), {
      target: { value: "New Parent" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({ guardianName: "New Parent" })
      );
    });

    await waitFor(() =>
      expect(screen.getByText(/guardian details updated/i)).toBeTruthy()
    );
  });
});
