import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { StaticAuthProvider } from "@/features/auth/auth-provider";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { AccountPage } from "./account-page";
import { ChangePasswordCard, ShowroomPasswordCard } from "./password-cards";

// the real dictionaries take seconds to transform under Vitest; tiny ones keep the meter test fast
vi.mock("@zxcvbn-ts/language-common", () => ({ dictionary: { "passwords-common": ["password", "123456"] }, adjacencyGraphs: {} }));
vi.mock("@zxcvbn-ts/language-en", () => ({ dictionary: { "commonWords-en": ["falcon", "night"] }, translations: undefined }));

const manager = makeUser({ permissions: ["showroom.password.view_or_change"] });
const STRONG = "Night#Falcon2026";

function renderCard(ui: React.ReactElement, overrides: { expire?: () => void } = {}) {
  return renderWithApp(
    <StaticAuthProvider user={manager} overrides={overrides}>
      {ui}
      <Toaster />
    </StaticAuthProvider>,
    { user: manager },
  );
}

const rule = (name: string) => screen.getByText(name).closest("li")!;

describe("change password", () => {
  it("updates the rule checklist and strength meter as the user types", async () => {
    const { user } = renderCard(<ChangePasswordCard />);
    expect(rule("A lowercase letter")).toHaveTextContent("(missing)");

    await user.type(screen.getByLabelText("New password"), "abc");
    expect(rule("A lowercase letter")).toHaveTextContent("(done)");
    expect(rule("An uppercase letter")).toHaveTextContent("(missing)");
    expect(rule("12 characters or more")).toHaveTextContent("(missing)");

    await user.type(screen.getByLabelText("New password"), "DEF#12345678");
    for (const name of ["12 characters or more", "An uppercase letter", "A number", "A symbol", "Doesn't contain your username"]) {
      expect(rule(name)).toHaveTextContent("(done)");
    }
    const meter = await screen.findByRole("meter", { name: "Strength" });
    // zxcvbn loads lazily on the first keystroke
    await waitFor(() => expect(meter).toHaveAttribute("aria-valuetext"));
    expect(screen.getByText(/^Strength: /)).toBeInTheDocument();
  });

  it("rejects a password containing the username and a mismatched confirmation", async () => {
    const patch = vi.fn();
    server.use(http.patch("/api/account/password", patch));
    const { user } = renderCard(<ChangePasswordCard />);

    await user.type(screen.getByLabelText("Current password"), "Manager#Wolf2026!");
    await user.type(screen.getByLabelText("New password"), "Xgh.manager#2026");
    expect(rule("Doesn't contain your username")).toHaveTextContent("(missing)");
    await user.type(screen.getByLabelText("Confirm new password"), "Something#Else2026");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("The password doesn't meet the requirements below.")).toBeInTheDocument();
    expect(screen.getByText("The passwords don't match.")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
    expect(patch).not.toHaveBeenCalled();
  });

  it("puts a wrong current password on its field", async () => {
    server.use(
      http.patch("/api/account/password", () =>
        HttpResponse.json(
          { statusCode: 400, message: "The password is not correct.", code: "WRONG_PASSWORD", errors: [{ field: "currentPassword", messages: ["x"] }] },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderCard(<ChangePasswordCard />);
    await user.type(screen.getByLabelText("Current password"), "not-it");
    await user.type(screen.getByLabelText("New password"), STRONG);
    await user.type(screen.getByLabelText("Confirm new password"), STRONG);
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("The password isn't correct.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
  });

  it("signs out everywhere after a successful change", async () => {
    let body: unknown;
    server.use(
      http.patch("/api/account/password", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const expire = vi.fn();
    const { user } = renderCard(<ChangePasswordCard />, { expire });
    await user.type(screen.getByLabelText("Current password"), "Manager#Wolf2026!");
    await user.type(screen.getByLabelText("New password"), STRONG);
    await user.type(screen.getByLabelText("Confirm new password"), STRONG);
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(expire).toHaveBeenCalledWith("password"));
    expect(expire).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ currentPassword: "Manager#Wolf2026!", newPassword: STRONG });
  });
});

describe("showroom password", () => {
  it("maps SHOWROOM_SAME_AS_DASHBOARD to the new password and confirms a change", async () => {
    let calls = 0;
    server.use(
      http.patch("/api/account/showroom-password", () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { statusCode: 400, message: "Use a different password.", code: "SHOWROOM_SAME_AS_DASHBOARD" },
            { status: 400 },
          );
        }
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderCard(<ShowroomPasswordCard />);
    await user.type(screen.getByLabelText("Your dashboard password"), "Manager#Wolf2026!");
    await user.type(screen.getByLabelText("New showroom password"), STRONG);
    await user.type(screen.getByLabelText("Confirm showroom password"), STRONG);
    await user.click(screen.getByRole("button", { name: "Change showroom password" }));

    expect(await screen.findByText("Use a different password from your dashboard password.")).toBeInTheDocument();
    expect(screen.getByLabelText("New showroom password")).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Change showroom password" }));
    expect(await screen.findByText("Showroom password changed. Showroom tablets must sign in again.")).toBeInTheDocument();
    expect(screen.getByLabelText("New showroom password")).toHaveValue("");
  });
});

describe("account page", () => {
  it("shows the profile and hides the showroom card from staff without a branch", async () => {
    server.use(http.get("/api/account/2fa", () => HttpResponse.json({ enabled: false, recoveryCodesRemaining: 0 })));
    const finance = makeUser({ username: "finance", displayName: "Finance Team", role: "FINANCE", branch: null, email: "fin@wolfcar.qa" });
    renderWithApp(<AccountPage />, { user: finance, locale: "ar" });

    expect(screen.getByRole("heading", { name: "حسابي" })).toBeInTheDocument();
    expect(screen.getByText("finance")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("المالية")).toBeInTheDocument();
    expect(screen.getByText("كل الفروع")).toBeInTheDocument();
    expect(screen.queryByText("كلمة مرور المعرض")).not.toBeInTheDocument();
    expect(await screen.findByText("غير مفعّل")).toBeInTheDocument();
  });

  it("offers the showroom password to branch staff", async () => {
    server.use(http.get("/api/account/2fa", () => HttpResponse.json({ enabled: false, recoveryCodesRemaining: 0 })));
    renderWithApp(<AccountPage />, { user: manager });
    expect(screen.getByRole("heading", { name: "Showroom password" })).toBeInTheDocument();
    expect(screen.getByText("Al Gharrafa Branch")).toBeInTheDocument();
    await screen.findByText("Off");
  });
});
