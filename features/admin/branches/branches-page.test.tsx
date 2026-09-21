import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { BranchView, IssuedCredentials } from "@/lib/api/types";
import { server } from "@/tests/msw";
import { makeUser, renderWithApp } from "@/tests/render";
import { resetAdminTestState } from "../shared/test-utils";
import { BranchesPage } from "./branches-page";

const GH: BranchView = {
  id: "b-gh",
  code: "GH",
  name: "Al Gharrafa Branch",
  nameAr: "فرع الغرافة",
  isActive: true,
  createdAt: "2026-09-01T08:00:00.000Z",
  manager: { id: "u-ghm", username: "gh.manager", displayName: "Al Gharrafa Manager", email: "ghm@wolfcar.qa", isActive: true },
  cashier: { id: "u-ghc", username: "gh.cashier", displayName: "Al Gharrafa Cashier", email: null, isActive: true },
};

const admin = makeUser({ role: "SUPER_ADMIN", branch: null, permissions: ["branch.manage", "user.manage"] });

beforeEach(() => resetAdminTestState("/en/dashboard/branches"));

describe("Branches page", () => {
  it("needs branch.manage", () => {
    renderWithApp(<BranchesPage />, { user: makeUser({ permissions: ["order.read.branch"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("Manage branches");
  });

  it("shows each branch with its manager and cashier", async () => {
    server.use(http.get("/api/branches", () => HttpResponse.json([GH])));
    renderWithApp(<BranchesPage />, { user: admin });
    const card = await screen.findByRole("article", { name: "Al Gharrafa Branch" });
    expect(within(card).getByText("GH")).toBeInTheDocument();
    expect(within(card).getByText("فرع الغرافة")).toBeInTheDocument();
    expect(within(card).getByText("Active")).toBeInTheDocument();
    const manager = within(card).getByRole("region", { name: "Branch Manager" });
    expect(within(manager).getByText("gh.manager")).toBeInTheDocument();
    expect(within(manager).getByText("ghm@wolfcar.qa")).toBeInTheDocument();
    expect(within(within(card).getByRole("region", { name: "Cashier" })).getByText("No email")).toBeInTheDocument();
  });

  it("shows branch names in Arabic first on the Arabic dashboard", async () => {
    server.use(http.get("/api/branches", () => HttpResponse.json([GH])));
    renderWithApp(<BranchesPage />, { user: admin, locale: "ar" });
    expect(await screen.findByRole("heading", { name: "فرع الغرافة" })).toBeInTheDocument();
  });

  it("creates a branch: uppercases and validates the code, then shows both accounts", async () => {
    let body: unknown;
    const credentials: IssuedCredentials[] = [
      { userId: "u1", username: "ts.manager", displayName: "Test Manager", role: "BRANCH_MANAGER", branchCode: "TS", password: "Mgr#Pass-0001", showroomPassword: "Show#Mgr-0001" },
      { userId: "u2", username: "ts.cashier", displayName: "Test Cashier", role: "CASHIER", branchCode: "TS", password: "Csh#Pass-0002", showroomPassword: "Show#Csh-0002" },
    ];
    server.use(
      http.get("/api/branches", () => HttpResponse.json([GH])),
      http.post("/api/branches", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ branch: { ...GH, id: "b-ts", code: "TS" }, credentials }, { status: 201 });
      }),
    );
    const { user } = renderWithApp(<BranchesPage />, { user: admin });
    await screen.findByRole("article", { name: "Al Gharrafa Branch" });

    await user.click(screen.getByRole("button", { name: "Add branch" }));
    const sheet = await screen.findByRole("dialog", { name: "New branch" });
    const code = within(sheet).getByLabelText("Code");
    await user.type(code, "t1");
    expect(code).toHaveValue("T1");
    await user.click(within(sheet).getByRole("button", { name: "Create" }));
    expect(await within(sheet).findByText("2–4 letters, e.g. WK.")).toBeInTheDocument();

    await user.clear(code);
    await user.type(code, "ts");
    expect(code).toHaveValue("TS");
    await user.type(within(sheet).getByLabelText("Name (English)"), "Test Branch");
    await user.type(within(sheet).getByLabelText("Name (Arabic)"), "فرع التجربة");
    const [manager, cashier] = within(sheet).getAllByRole("group");
    await user.type(within(manager).getByLabelText("Full name"), "Test Manager");
    await user.type(within(manager).getByLabelText(/Email/), "mgr@wolfcar.qa");
    await user.type(within(cashier).getByLabelText("Full name"), "Test Cashier");
    await user.click(within(sheet).getByRole("button", { name: "Create" }));

    const creds = await screen.findByRole("dialog", { name: "Save these credentials now" });
    expect(body).toEqual({
      code: "TS",
      name: "Test Branch",
      nameAr: "فرع التجربة",
      manager: { displayName: "Test Manager", email: "mgr@wolfcar.qa" },
      cashier: { displayName: "Test Cashier" },
    });
    for (const secret of ["ts.manager", "Mgr#Pass-0001", "Show#Mgr-0001", "ts.cashier", "Csh#Pass-0002", "Show#Csh-0002"]) {
      expect(within(creds).getByText(secret)).toBeInTheDocument();
    }
    await user.click(within(creds).getByRole("button", { name: "I've saved them" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save these credentials now" })).not.toBeInTheDocument());
  });

  it("maps a duplicate code to the code field", async () => {
    server.use(
      http.get("/api/branches", () => HttpResponse.json([GH])),
      http.post("/api/branches", () =>
        HttpResponse.json({ statusCode: 409, error: "Conflict", code: "DUPLICATE", message: "Duplicate code" }, { status: 409 }),
      ),
    );
    const { user } = renderWithApp(<BranchesPage />, { user: admin });
    await user.click(await screen.findByRole("button", { name: "Add branch" }));
    const sheet = await screen.findByRole("dialog", { name: "New branch" });
    await user.type(within(sheet).getByLabelText("Code"), "gh");
    await user.type(within(sheet).getByLabelText("Name (English)"), "Another");
    await user.type(within(sheet).getByLabelText("Name (Arabic)"), "فرع آخر");
    const [manager, cashier] = within(sheet).getAllByRole("group");
    await user.type(within(manager).getByLabelText("Full name"), "Some Manager");
    await user.type(within(cashier).getByLabelText("Full name"), "Some Cashier");
    await user.click(within(sheet).getByRole("button", { name: "Create" }));
    expect(await within(sheet).findByText("A branch with this code already exists.")).toBeInTheDocument();
  });

  it("replaces the cashier and shows the new account once", async () => {
    let body: unknown;
    server.use(
      http.get("/api/branches", () => HttpResponse.json([GH])),
      http.post("/api/branches/b-gh/staff/cashier/replace", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          branch: GH,
          credentials: { userId: "u3", username: "gh.cashier2", displayName: "New Cashier", role: "CASHIER", branchCode: "GH", password: "New#Pass-3333", showroomPassword: "Show#New-3333" },
        });
      }),
    );
    const { user } = renderWithApp(<BranchesPage />, { user: admin });
    const card = await screen.findByRole("article", { name: "Al Gharrafa Branch" });
    await user.click(within(within(card).getByRole("region", { name: "Cashier" })).getByRole("button", { name: "Replace the Cashier" }));
    const dialog = await screen.findByRole("dialog", { name: "Replace the Cashier" });
    expect(dialog).toHaveTextContent("Al Gharrafa Cashier");
    await user.type(within(dialog).getByLabelText("Full name"), "New Cashier");
    await user.click(within(dialog).getByRole("button", { name: "Replace" }));
    const creds = await screen.findByRole("dialog", { name: "Save these credentials now" });
    expect(body).toEqual({ displayName: "New Cashier" });
    expect(within(creds).getByText("New#Pass-3333")).toBeInTheDocument();
  });
});
