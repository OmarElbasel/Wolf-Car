import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type EndReason, StaticAuthProvider } from "@/features/auth/auth-provider";
import { renderWithApp } from "@/tests/render";
import { router, setPathname } from "@/tests/setup";
import { DashboardShell } from "./shell";

function renderSignedOut(endReason: EndReason | null) {
  return renderWithApp(
    <StaticAuthProvider user={null} overrides={{ endReason }}>
      <DashboardShell>page</DashboardShell>
    </StaticAuthProvider>,
    { user: null },
  );
}

describe("DashboardShell sign-out redirects", () => {
  beforeEach(() => setPathname("/dashboard/orders"));

  it("sends an expired session back with the page it was on", async () => {
    renderSignedOut("expired");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?reason=expired&next=%2Fdashboard%2Forders"));
  });

  it("treats a session that was never restored as expired", async () => {
    renderSignedOut(null);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("reason=expired")));
  });

  it("goes to a plain login page after signing out", async () => {
    renderSignedOut("signedOut");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("explains a password change", async () => {
    renderSignedOut("password");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login?reason=password"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});
