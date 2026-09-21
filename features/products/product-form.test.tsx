import { File as NodeFile } from "node:buffer";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { server } from "@/tests/msw";
import { renderWithApp } from "@/tests/render";
import { makeProduct, manager } from "./fixtures";
import { ProductFormSheet } from "./product-form";

// jsdom's FormData/File can't be sent through Node's fetch (MSW); use Node's own for the multipart tests
const JsdomFormData = globalThis.FormData;
beforeAll(async () => {
  const probe = await new Response("a=1", { headers: { "content-type": "application/x-www-form-urlencoded" } }).formData();
  globalThis.FormData = probe.constructor as typeof FormData;
});
afterAll(() => {
  globalThis.FormData = JsdomFormData;
});

const png = (name = "wheel.png", size?: number) => {
  const file = new NodeFile([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" }) as unknown as File;
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
};
const pickFile = (file: File) => fireEvent.change(screen.getByLabelText("Image"), { target: { files: [file] } });

function renderCreate() {
  return renderWithApp(<ProductFormSheet open product={null} onOpenChange={vi.fn()} />, { user: manager() });
}

describe("product form", () => {
  it("has no price field and explains that Finance prices products", () => {
    renderCreate();
    expect(screen.getByRole("dialog", { name: "New product" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.queryByLabelText(/price/i)).not.toBeInTheDocument();
    expect(document.querySelector('[name="price"]')).toBeNull();
    expect(screen.getByText("Finance sets the price after the product is created.")).toBeInTheDocument();
  });

  it("requires an image when creating", async () => {
    const { user } = renderCreate();
    await user.type(screen.getByLabelText("Name"), "Wheel cleaner");
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(await screen.findByText("Add a product image.")).toBeInTheDocument();
  });

  it("rejects a non-image file and a file over 5 MB before uploading", async () => {
    renderCreate();
    pickFile(new NodeFile(["hello"], "notes.txt", { type: "text/plain" }) as unknown as File);
    expect(await screen.findByText("Use a JPEG, PNG or WebP image.")).toBeInTheDocument();

    pickFile(png("huge.png", 6 * 1024 * 1024));
    expect(await screen.findByText("The image must be 5 MB or smaller.")).toBeInTheDocument();

    pickFile(png());
    await waitFor(() => expect(screen.queryByText("The image must be 5 MB or smaller.")).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: "New image selected" })).toBeInTheDocument();
  });

  it("submits multipart form data with name, barcode, description and image (no price)", async () => {
    let sent: FormData | null = null;
    server.use(
      http.post("/api/products", async ({ request }) => {
        sent = await request.formData();
        return HttpResponse.json(makeProduct({ name: "Wheel cleaner" }), { status: 201 });
      }),
    );
    const onOpenChange = vi.fn();
    const { user } = renderWithApp(<ProductFormSheet open product={null} onOpenChange={onOpenChange} />, { user: manager() });
    await user.type(screen.getByLabelText("Name"), "  Wheel cleaner ");
    await user.type(screen.getByLabelText(/Description/), "Acid-free");
    await user.type(screen.getByLabelText(/Barcode/), "WC-100");
    pickFile(png());
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const form = sent as unknown as FormData;
    expect(form.get("name")).toBe("Wheel cleaner");
    expect(form.get("description")).toBe("Acid-free");
    expect(form.get("barcode")).toBe("WC-100");
    expect(form.has("price")).toBe(false);
    const image = form.get("image") as File;
    expect(image.name).toBe("wheel.png");
    expect(image.type).toBe("image/png");
  });

  it("shows a duplicate barcode from the API on the barcode field", async () => {
    server.use(
      http.patch("/api/products/:id", () =>
        HttpResponse.json(
          { statusCode: 409, error: "Conflict", code: "DUPLICATE", message: "Another product already uses this barcode." },
          { status: 409 },
        ),
      ),
    );
    const product = makeProduct({ name: "Oil filter", barcode: "OF-1" });
    const { user } = renderWithApp(<ProductFormSheet open product={product} onOpenChange={vi.fn()} />, { user: manager() });
    const barcode = screen.getByLabelText(/Barcode/);
    await user.clear(barcode);
    await user.type(barcode, "WC-100");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Another product already uses this barcode.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Barcode/)).toHaveAttribute("aria-invalid", "true");
  });

  it("sends only the changed fields when editing, and an empty string to clear", async () => {
    let sent: FormData | null = null;
    server.use(
      http.patch("/api/products/:id", async ({ request }) => {
        sent = await request.formData();
        return HttpResponse.json(makeProduct());
      }),
    );
    const product = makeProduct({ name: "Oil filter", barcode: "OF-1", description: "Old text" });
    const { user } = renderWithApp(<ProductFormSheet open product={product} onOpenChange={vi.fn()} />, { user: manager() });
    await user.clear(screen.getByLabelText(/Description/));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(sent).not.toBeNull());
    const form = sent as unknown as FormData;
    expect([...form.keys()]).toEqual(["description"]);
    expect(form.get("description")).toBe("");
  });
});
