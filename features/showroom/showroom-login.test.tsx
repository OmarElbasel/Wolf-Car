import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaticAuthProvider } from "@/features/auth/auth-provider";
import type { Profile } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { router } from "@/tests/setup";
import { ShowroomLogin } from "./showroom-login";

const BRANCHES = [
  { id: "b-bo", code: "BO", name: "Bin Omran Branch", nameAr: "فرع بن عمران" },
  { id: "b-gh", code: "GH", name: "Al Gharrafa Branch", nameAr: "فرع الغرافة" },
];

type PinLogin = (branchId: string, pin: string) => Promise<Profile>;

function renderLogin(pinLogin: PinLogin) {
  return renderWithApp(
    <StaticAuthProvider user={null} overrides={{ pinLogin }}>
      <ShowroomLogin />
    </StaticAuthProvider>,
    { user: null },
  );
}

beforeEach(() => {
  localStorage.clear();
  server.use(http.get("/api/auth/showroom/branches", () => HttpResponse.json(BRANCHES)));
});

describe("showroom sign-in", () => {
  it("asks for the branch and its PIN, explains a wrong PIN, and opens the showroom on the right one", async () => {
    const pinLogin = vi
      .fn<PinLogin>()
      .mockRejectedValueOnce(new ApiError(401, "no", "SHOWROOM_PIN_INVALID"))
      .mockResolvedValueOnce(makeUser());
    const { user } = renderLogin(pinLogin);

    expect(screen.getByRole("heading", { name: "Showroom sign in" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Open the showroom" });
    expect(open).toBeDisabled();

    await user.selectOptions(await screen.findByLabelText("Branch"), await screen.findByRole("option", { name: "Bin Omran Branch" }));
    await user.type(screen.getByLabelText("PIN"), "12345");
    // five digits are not a PIN yet
    expect(open).toBeDisabled();
    await user.type(screen.getByLabelText("PIN"), "6");
    await user.click(open);
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong PIN.");
    expect(screen.getByLabelText("PIN")).toHaveValue("");

    // Arabic-Indic digits typed on an Arabic keyboard are the same PIN
    await user.type(screen.getByLabelText("PIN"), "٤٨٢٩١٣");
    await user.click(open);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/showroom"));
    expect(pinLogin).toHaveBeenLastCalledWith("b-bo", "482913");
  });

  it("remembers the branch this screen signed in to", async () => {
    localStorage.setItem("wc.showroom.branch", "b-gh");
    renderLogin(vi.fn<PinLogin>());
    await waitFor(() => expect(screen.getByLabelText("Branch")).toHaveValue("b-gh"));
  });

  it("says so when no branch has a PIN yet", async () => {
    server.use(http.get("/api/auth/showroom/branches", () => HttpResponse.json([])));
    renderLogin(vi.fn<PinLogin>());
    expect(await screen.findByText("No branch has a showroom PIN yet. Set one in the dashboard under Branches.")).toBeInTheDocument();
  });

  it("skips the form when the screen is already signed in", () => {
    renderWithApp(<ShowroomLogin />, { user: makeUser() });
    expect(router.replace).toHaveBeenCalledWith("/showroom");
  });
});
