import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock auth and api modules
vi.mock("@/lib/auth", () => ({
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  signIn: vi.fn(),
}));

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

  it("shows an error if privacy checkbox not ticked on submit", async () => {
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "Password1!");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("calls signUp with email and password on valid submit", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "Password1!");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("test@example.com", "Password1!")
    );
  });

  it("shows verification code input after successful signUp", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "Password1!");
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
    await userEvent.type(screen.getByLabelText(/password/i), "Password1!");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => screen.getByLabelText(/verification code/i));

    await userEvent.type(screen.getByLabelText(/verification code/i), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => expect(confirmSignUp).toHaveBeenCalledWith("test@example.com", "123456"));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("test@example.com", "Password1!"));
    await waitFor(() => expect(registerPatient).toHaveBeenCalledWith("test@example.com", "v1.0"));
  });

  it("shows an error message when signUp fails", async () => {
    (signUp as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("UsernameExistsException"));
    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "Password1!");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
  });
});
