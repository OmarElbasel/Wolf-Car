import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaticAuthProvider } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { makeUser, renderWithApp } from "@/tests/render";
import { router } from "@/tests/setup";
import { ShowroomLogin } from "./showroom-login";

describe("showroom sign-in", () => {
  it("explains a refused account and opens the showroom on success", async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(403, "no", "NO_SHOWROOM_ACCESS"))
      .mockResolvedValueOnce(makeUser());
    const { user } = renderWithApp(
      <StaticAuthProvider user={null} overrides={{ login }}>
        <ShowroomLogin />
      </StaticAuthProvider>,
      { user: null },
    );

    expect(screen.getByRole("heading", { name: "Showroom sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Staff dashboard sign in" })).toHaveAttribute("href", "/login");

    await user.type(screen.getByLabelText("Username"), "finance");
    await user.type(screen.getByLabelText("Showroom password"), "Ledger#Wolf2026!");
    await user.click(screen.getByRole("button", { name: "Open the showroom" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This account can't use the showroom.");
    expect(screen.getByLabelText("Showroom password")).toHaveValue("");

    await user.type(screen.getByLabelText("Showroom password"), "Showroom#2026!");
    await user.click(screen.getByRole("button", { name: "Open the showroom" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/showroom"));
    expect(login).toHaveBeenLastCalledWith("finance", "Showroom#2026!");
  });

  it("skips the form when the tablet is already signed in", () => {
    renderWithApp(<ShowroomLogin />, { user: makeUser() });
    expect(router.replace).toHaveBeenCalledWith("/showroom");
  });
});
