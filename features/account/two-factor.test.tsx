import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import { StaticAuthProvider } from "@/features/auth/auth-provider";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { TwoFactorCard } from "./two-factor";

const finance = makeUser({ username: "finance", displayName: "Finance", role: "FINANCE", branch: null });
const CODES = Array.from({ length: 10 }, (_, i) => `abcd${i + 2}-efgh${(i % 6) + 2}`);

function renderCard(reload = vi.fn().mockResolvedValue(undefined)) {
  const view = renderWithApp(
    <StaticAuthProvider user={finance} overrides={{ reload }}>
      <TwoFactorCard />
      <Toaster />
    </StaticAuthProvider>,
    { user: finance },
  );
  return { ...view, reload };
}

describe("two-step verification", () => {
  it("turns 2FA on: password → QR and code → recovery codes → acknowledge", async () => {
    let enabled = false;
    const calls: { path: string; body: unknown }[] = [];
    server.use(
      http.get("/api/account/2fa", () => HttpResponse.json({ enabled, recoveryCodesRemaining: enabled ? 10 : 0 })),
      http.post("/api/account/2fa/setup", async ({ request }) => {
        calls.push({ path: "setup", body: await request.json() });
        return HttpResponse.json({
          secret: "JBSWY3DPEHPK3PXP",
          otpauthUrl: "otpauth://totp/Wolf%20Car:finance?secret=JBSWY3DPEHPK3PXP",
          qrDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        });
      }),
      http.post("/api/account/2fa/enable", async ({ request }) => {
        calls.push({ path: "enable", body: await request.json() });
        enabled = true;
        return HttpResponse.json({ recoveryCodes: CODES });
      }),
    );
    const { user, reload } = renderCard();

    await user.click(await screen.findByRole("button", { name: "Turn on 2FA" }));
    let dialog = await screen.findByRole("dialog", { name: "Turn on two-step verification" });
    expect(within(dialog).getByText("Step 1 of 3")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(await within(dialog).findByText("This field is required.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Password"), "Ledger#Wolf2026!");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(await within(dialog).findByRole("img", { name: "QR code to add Wolf Car to your authenticator app" })).toBeInTheDocument();
    expect(within(dialog).getByText("Step 2 of 3")).toBeInTheDocument();
    expect(within(dialog).getByTestId("manual-key")).toHaveTextContent("JBSW Y3DP EHPK 3PXP");
    await user.type(within(dialog).getByLabelText("Code from the app"), "123456");

    dialog = await screen.findByRole("dialog", { name: "Your recovery codes" });
    const codes = within(dialog).getByTestId("recovery-codes");
    expect(within(codes).getAllByRole("listitem")).toHaveLength(10);
    expect(codes).toHaveTextContent(CODES[0]);
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Download .txt" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "I've saved them" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(reload).toHaveBeenCalled();
    expect(await screen.findByText("On")).toBeInTheDocument();
    expect(screen.getByText("10 recovery codes left")).toBeInTheDocument();
    expect(calls).toEqual([
      { path: "setup", body: { password: "Ledger#Wolf2026!" } },
      { path: "enable", body: { code: "123456" } },
    ]);
  });

  it("shows a wrong password and an invalid code inline", async () => {
    server.use(
      http.get("/api/account/2fa", () => HttpResponse.json({ enabled: false, recoveryCodesRemaining: 0 })),
      http.post("/api/account/2fa/setup", async ({ request }) => {
        const { password } = (await request.json()) as { password: string };
        if (password !== "right")
          return HttpResponse.json({ statusCode: 400, message: "no", code: "WRONG_PASSWORD" }, { status: 400 });
        return HttpResponse.json({ secret: "JBSWY3DPEHPK3PXP", otpauthUrl: "otpauth://x", qrDataUrl: "data:image/png;base64,iVBORw0KGgo=" });
      }),
      http.post("/api/account/2fa/enable", () =>
        HttpResponse.json({ statusCode: 400, message: "no", code: "INVALID_2FA" }, { status: 400 }),
      ),
    );
    const { user } = renderCard();
    await user.click(await screen.findByRole("button", { name: "Turn on 2FA" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Password"), "wrong");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(await within(dialog).findByText("The password isn't correct.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Password"));
    await user.type(within(dialog).getByLabelText("Password"), "right");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.type(await within(dialog).findByLabelText("Code from the app"), "000000");
    expect(await within(dialog).findByText("That code isn't valid. Check the time on your phone and try again.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Code from the app")).toHaveValue("");
  });

  it("turns 2FA off with the password and a recovery code", async () => {
    let body: unknown;
    let enabled = true;
    server.use(
      http.get("/api/account/2fa", () => HttpResponse.json({ enabled, recoveryCodesRemaining: enabled ? 2 : 0 })),
      http.post("/api/account/2fa/disable", async ({ request }) => {
        body = await request.json();
        enabled = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, reload } = renderCard();
    expect(await screen.findByText("2 recovery codes left")).toBeInTheDocument();
    expect(screen.getByText("Few recovery codes left. Create new ones so you don't get locked out.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Turn off 2FA" }));
    const dialog = await screen.findByRole("dialog", { name: "Turn off two-step verification" });
    await user.type(within(dialog).getByLabelText("Password"), "Ledger#Wolf2026!");
    await user.click(within(dialog).getByRole("button", { name: "Use a recovery code" }));
    await user.type(within(dialog).getByLabelText("Recovery code"), "ABCDE-FGH18");
    await user.click(within(dialog).getByRole("button", { name: "Turn off" }));
    expect(await within(dialog).findByText("Recovery codes look like abcde-fghij.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Recovery code"));
    await user.type(within(dialog).getByLabelText("Recovery code"), " ABCDE-FGH23 ");
    await user.click(within(dialog).getByRole("button", { name: "Turn off" }));
    expect(await screen.findByText("Two-step verification is off")).toBeInTheDocument();
    expect(body).toEqual({ password: "Ledger#Wolf2026!", recoveryCode: "abcde-fgh23" });
    expect(reload).toHaveBeenCalled();
    expect(await screen.findByText("Off")).toBeInTheDocument();
  });
});
