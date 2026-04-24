import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/api", () => ({ getMe: vi.fn(), setToken: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ token: null, setToken: vi.fn() }),
}));

import { signIn } from "@/lib/auth";
import LoginPage from "@/app/(auth)/login/page";

beforeEach(() => vi.clearAllMocks());

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("calls signIn with email and password on submit", async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce("tok");
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("a@b.com", "pw"));
  });

  it("shows error message on bad credentials", async () => {
    (signIn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Incorrect username or password."));
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
