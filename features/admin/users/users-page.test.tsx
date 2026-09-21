import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { IssuedCredentials, UserView } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { resetAdminTestState } from "../shared/test-utils";
import { UsersPage } from "./users-page";

const ME = "00000000-0000-4000-8000-00000000000a";

function view(overrides: Partial<UserView>): UserView {
  return {
    id: crypto.randomUUID(),
    username: "someone",
    displayName: "Someone",
    email: null,
    role: "FINANCE",
    branch: null,
    isActive: true,
    twoFactorEnabled: false,
    hasShowroomPassword: false,
    locked: false,
    lastLoginAt: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    ...overrides,
  };
}

const USERS: UserView[] = [
  view({ id: ME, username: "admin", displayName: "System Administrator", role: "SUPER_ADMIN", lastLoginAt: new Date().toISOString() }),
  view({ username: "finance", displayName: "Finance Team", role: "FINANCE", twoFactorEnabled: true }),
  view({
    username: "gh.cashier",
    displayName: "Gharrafa Cashier",
    role: "CASHIER",
    hasShowroomPassword: true,
    locked: true,
    branch: { id: "b-gh", code: "GH", name: "Al Gharrafa Branch", nameAr: "فرع الغرافة" },
  }),
];

const admin = makeUser({
  id: ME,
  username: "admin",
  displayName: "System Administrator",
  role: "SUPER_ADMIN",
  branch: null,
  permissions: ["user.manage", "permission.manage", "branch.manage"],
});

/** Registers the list endpoints and records every /users query string. */
function mockList(items = USERS) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get("/api/users", ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items, page: 1, pageSize: 20, total: items.length });
    }),
    http.get("/api/branches/options", () =>
      HttpResponse.json([{ id: "b-gh", code: "GH", name: "Al Gharrafa Branch", nameAr: "فرع الغرافة", isActive: true }]),
    ),
  );
  return queries;
}

beforeEach(() => resetAdminTestState("/en/dashboard/users"));

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

describe("Users page", () => {
  it("shows a friendly message without user.manage", () => {
    renderWithApp(<UsersPage />, { user: makeUser({ permissions: ["product.read"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("You can't open this page");
    expect(screen.getByRole("alert")).toHaveTextContent("Manage users");
  });

  it("lists users with their role, branch and status", async () => {
    mockList();
    renderWithApp(<UsersPage />, { user: admin });
    const cashier = await screen.findByText("Gharrafa Cashier");
    const row = cashier.closest("tr") as HTMLElement;
    expect(within(row).getByText("gh.cashier")).toBeInTheDocument();
    expect(within(row).getByText("Cashier")).toBeInTheDocument();
    expect(within(row).getByText("Al Gharrafa Branch")).toBeInTheDocument();
    expect(within(row).getByText("Locked")).toBeInTheDocument();
    expect(within(row).getByText("Never")).toBeInTheDocument();
    expect(within(rowOf("Finance Team")).getByText("2FA on")).toBeInTheDocument();
  });

  it("creates a user and shows the one-time credentials", async () => {
    mockList();
    let body: unknown;
    const credentials: IssuedCredentials = {
      userId: "u-new",
      username: "sara.ali",
      displayName: "Sara Ali",
      role: "FINANCE",
      branchCode: null,
      password: "Gen3rated#Pass-2026",
    };
    server.use(
      http.post("/api/users", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: view({ id: "u-new", username: "sara.ali", displayName: "Sara Ali" }), credentials }, { status: 201 });
      }),
    );
    const { user } = renderWithApp(<UsersPage />, { user: admin });
    await screen.findByText("Finance Team");

    await user.click(screen.getByRole("button", { name: "Add user" }));
    const dialog = await screen.findByRole("dialog", { name: "New user" });
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(await within(dialog).findByText("This field is required.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Full name"), "Sara Ali");
    await user.type(within(dialog).getByLabelText(/Email/), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(await within(dialog).findByText("Enter a valid email address.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/Email/));
    await user.type(within(dialog).getByLabelText(/Email/), "sara@wolfcar.qa");
    expect(within(dialog).getByRole("radio", { name: "Finance" })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    const creds = await screen.findByRole("dialog", { name: "Save these credentials now" });
    expect(body).toEqual({ displayName: "Sara Ali", email: "sara@wolfcar.qa", role: "FINANCE" });
    expect(within(creds).getByText("sara.ali")).toBeInTheDocument();
    expect(within(creds).getByText("Gen3rated#Pass-2026")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "New user" })).not.toBeInTheDocument();

    await user.click(within(creds).getByRole("button", { name: "I've saved them" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save these credentials now" })).not.toBeInTheDocument());
  });

  it("offers only the actions that make sense for each row", async () => {
    mockList();
    const { user } = renderWithApp(<UsersPage />, { user: admin });
    await screen.findByText("Gharrafa Cashier");

    // branch staff: showroom reset and unlock, no delete
    await user.click(screen.getByRole("button", { name: "Actions for Gharrafa Cashier" }));
    let menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Reset showroom password" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Unlock" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Deactivate" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Delete account" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Reset two-factor" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    // own row: no deactivate, delete or password reset
    await user.click(screen.getByRole("button", { name: "Actions for System Administrator" }));
    menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Delete account" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Reset password" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    // another admin account: delete and 2FA reset available, no showroom reset
    await user.click(screen.getByRole("button", { name: "Actions for Finance Team" }));
    menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Delete account" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reset two-factor" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Reset showroom password" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Permissions" })).toHaveAttribute(
      "href",
      `/dashboard/permissions?tab=users&user=${USERS[1].id}`,
    );
  });

  it("resets a showroom password after confirmation and shows it once", async () => {
    mockList();
    const cashier = USERS[2];
    server.use(
      http.post(`/api/users/${cashier.id}/reset-showroom-password`, () =>
        HttpResponse.json({
          userId: cashier.id,
          username: cashier.username,
          displayName: cashier.displayName,
          role: "CASHIER",
          branchCode: "GH",
          showroomPassword: "Show#Room-9911",
        }),
      ),
    );
    const { user } = renderWithApp(<UsersPage />, { user: admin });
    await user.click(await screen.findByRole("button", { name: "Actions for Gharrafa Cashier" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reset showroom password" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Reset showroom password" }));
    const creds = await screen.findByRole("dialog", { name: "Save these credentials now" });
    expect(within(creds).getByText("Show#Room-9911")).toBeInTheDocument();
  });

  it("puts the filters in the request query", async () => {
    const queries = mockList();
    const { user } = renderWithApp(<UsersPage />, { user: admin });
    await screen.findByText("Finance Team");
    expect(queries[0].get("pageSize")).toBe("20");
    expect(queries[0].has("q")).toBe(false);

    await user.type(screen.getByRole("searchbox", { name: "Search name, username or email" }), "gh");
    await waitFor(() => expect(queries.at(-1)?.get("q")).toBe("gh"));

    await user.click(screen.getByRole("combobox", { name: "Role" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await waitFor(() => expect(queries.at(-1)?.get("role")).toBe("FINANCE"));

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Inactive" }));
    await waitFor(() => {
      const last = queries.at(-1);
      expect(last?.get("status")).toBe("inactive");
      expect(last?.get("q")).toBe("gh");
      expect(last?.get("role")).toBe("FINANCE");
    });
    expect(window.location.search).toContain("status=inactive");
  });
});
