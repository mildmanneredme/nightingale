import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock auth and api modules
vi.mock("@/lib/auth", () => ({
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  signIn: vi.fn(),
  resendConfirmationCode: vi.fn(),
}));

// UX-005 raised the live-validation password floor to 12 chars + upper + lower
// + number + symbol (matches the Cognito user-pool policy in
// infra/terraform/modules/cognito/main.tf). The submit button is disabled
// until all five rules pass — pre-UX-005 tests used "Password1!" (10 chars)
// which now fails the length check.
const VALID_PASSWORD = "Password1234!";

vi.mock("@/lib/api", () => ({
  registerPatient: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { signUp, confirmSignUp, signIn } from "@/lib/auth";
import { registerPatient } from "@/lib/api";
import RegisterPage from "@/app/(auth)/register/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterPage", () => {
  it("renders email and password fields and privacy checkbox", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("disables submit until privacy is ticked, then enables once all conditions pass", async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), VALID_PASSWORD);

    // UX-005: button stays disabled while privacy is unchecked.
    const submit = screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    // Clicking a disabled button is a no-op — signUp must not have fired.
    fireEvent.click(submit);
    expect(signUp).not.toHaveBeenCalled();

    // Tick privacy → button enables.
    await userEvent.click(screen.getByRole("checkbox"));
    expect(submit.disabled).toBe(false);
  });

  it("calls signUp with email and password on valid submit", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), VALID_PASSWORD);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("test@example.com", VALID_PASSWORD)
    );
  });

  it("shows verification code input after successful signUp", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), VALID_PASSWORD);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
    );
  });

  it("calls confirmSignUp and signIn then registerPatient on code submit", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    (confirmSignUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce("access-token");
    (registerPatient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "p1", email: "test@example.com" });

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), VALID_PASSWORD);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => screen.getByLabelText(/verification code/i));

    await userEvent.type(screen.getByLabelText(/verification code/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => expect(confirmSignUp).toHaveBeenCalledWith("test@example.com", "123456"));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("test@example.com", VALID_PASSWORD));
    await waitFor(() => expect(registerPatient).toHaveBeenCalledWith("test@example.com", "v1.0"));
  });

  it("shows an error message when signUp fails", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("UsernameExistsException"));
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), VALID_PASSWORD);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
  });
});
