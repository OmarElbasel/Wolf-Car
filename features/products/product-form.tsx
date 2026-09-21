"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Info } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type DragEvent, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api/client";
import { fieldErrors } from "@/lib/api/errors";
import type { Product } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { cn } from "@/lib/utils";
import { BARCODE_PATTERN, IMAGE_MAX_BYTES, IMAGE_MIME_TYPES, PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX } from "@/shared/validation";
import { productKeys } from "./queries";

const IMAGE_ERROR_CODES = new Set(["IMAGE_REQUIRED", "UNSUPPORTED_IMAGE", "UNREADABLE_IMAGE", "IMAGE_TOO_SMALL", "IMAGE_TOO_LARGE", "FILE_TOO_LARGE"]);
const NAME_MIN = 2;

/** "imageType" / "imageSize" (Validation keys) when the file can't be uploaded, else null. */
export function imageProblem(file: File): "imageType" | "imageSize" | null {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) return "imageType";
  if (file.size > IMAGE_MAX_BYTES) return "imageSize";
  return null;
}

const schema = (creating: boolean) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, "required")
      .min(NAME_MIN, "tooShort")
      .max(PRODUCT_NAME_MAX, "tooLong"),
    description: z.string().trim().max(PRODUCT_DESCRIPTION_MAX, "tooLong"),
    barcode: z
      .string()
      .trim()
      .refine((v) => v === "" || BARCODE_PATTERN.test(v), "barcode"),
    image: z
      .custom<File | null>((v) => v === null || (typeof v === "object" && "size" in (v as object)))
      .superRefine((file, ctx) => {
        if (!file) {
          if (creating) ctx.addIssue({ code: "custom", message: "imageRequired" });
          return;
        }
        const problem = imageProblem(file);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
  });

type Values = z.infer<ReturnType<typeof schema>>;

/**
 * Create or edit a product's details. There is deliberately no price here:
 * Finance sets prices separately. Sends multipart form data; on edit only the
 * fields that changed (empty barcode/description clears them).
 */
export function ProductForm({ product, onDone, onCancel }: { product: Product | null; onDone: (saved: Product) => void; onCancel: () => void }) {
  const t = useTranslations("Products.form");
  const tv = useTranslations("Validation");
  const tc = useTranslations("Common");
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const creating = product === null;
  const [preview, setPreview] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema(creating)),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      barcode: product?.barcode ?? "",
      image: null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  // the preview URL is created when a file is picked; release it when replaced or on unmount
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = (file: File | undefined, onChange: (file: File | null) => void) => {
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) {
      form.setError("image", { message: problem });
      return;
    }
    form.clearErrors("image");
    onChange(file);
    setPreview(URL.createObjectURL(file));
  };

  const errorText = (key: string | undefined, values?: Record<string, number>) =>
    key === "tooShort" || key === "tooLong" ? tv(key, values ?? {}) : key;

  const submit = form.handleSubmit(async (values) => {
    const data = new FormData();
    const name = values.name.trim();
    const description = values.description.trim();
    const barcode = values.barcode.trim();
    if (creating) {
      data.set("name", name);
      if (description) data.set("description", description);
      if (barcode) data.set("barcode", barcode);
    } else {
      if (name !== product.name) data.set("name", name);
      if (description !== (product.description ?? "")) data.set("description", description);
      if (barcode !== (product.barcode ?? "")) data.set("barcode", barcode);
    }
    if (values.image) data.set("image", values.image);
    if (!creating && [...data.keys()].length === 0) {
      onCancel();
      return;
    }
    try {
      const saved = creating
        ? await api<Product>("/products", { method: "POST", form: data })
        : await api<Product>(`/products/${product.id}`, { method: "PATCH", form: data });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(creating ? t("created") : t("updated"));
      onDone(saved);
    } catch (error) {
      if (error instanceof ApiError && error.code && IMAGE_ERROR_CODES.has(error.code)) {
        form.setError("image", { message: message(error) }, { shouldFocus: true });
        return;
      }
      if (error instanceof ApiError && error.code === "DUPLICATE") {
        form.setError("barcode", { message: t("duplicateBarcode") }, { shouldFocus: true });
        return;
      }
      const fields = fieldErrors(error);
      const known = (["name", "description", "barcode", "image"] as const).filter((f) => f in fields);
      if (known.length) {
        // server messages are English; show our own translated rule instead
        for (const f of known) form.setError(f, { message: f === "barcode" ? "barcode" : f === "image" ? "imageType" : "invalid" });
        return;
      }
      toast.error(message(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
      <SheetBody className="grid content-start gap-4">
        {creating && (
          <p className="flex items-start gap-2 rounded-[var(--radius-brand)] bg-sand px-3 py-2.5 text-sm text-ink-2">
            <Info className="mt-0.5 size-4 shrink-0 text-accent-ink" strokeWidth={1.8} aria-hidden="true" />
            {t("noPriceNote")}
          </p>
        )}
        <Field label={t("name")} error={errorText(errors.name?.message, { min: NAME_MIN, max: PRODUCT_NAME_MAX })}>
          <Input dir="auto" autoComplete="off" maxLength={PRODUCT_NAME_MAX + 20} {...form.register("name")} />
        </Field>
        <Field label={t("description")} optional error={errorText(errors.description?.message, { max: PRODUCT_DESCRIPTION_MAX })}>
          <Textarea dir="auto" rows={3} className="max-h-60" {...form.register("description")} />
        </Field>
        <Field label={t("barcode")} optional error={errors.barcode?.message}>
          <Input dir="ltr" autoComplete="off" spellCheck={false} className="font-mono" {...form.register("barcode")} />
        </Field>
        <Controller
          control={form.control}
          name="image"
          render={({ field }) => (
            <Field label={t("image")} hint={t("imageHint")} error={errors.image?.message} optional={!creating}>
              <ImageInput
                current={preview ?? product?.imageUrl ?? null}
                isNew={preview !== null}
                onPick={(file) => pick(file, field.onChange)}
              />
            </Field>
          )}
        />
      </SheetBody>
      <SheetFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tc("saving") : creating ? t("submitCreate") : t("submitSave")}
        </Button>
      </SheetFooter>
    </form>
  );
}

/**
 * File input styled as a drop zone: the native input stays focusable (visually
 * hidden) and the zone is its label, so click, keyboard and drag-and-drop all work.
 * Receives id/aria-* from <Field>.
 */
function ImageInput({
  current,
  isNew,
  onPick,
  ...aria
}: {
  current: string | null;
  isNew: boolean;
  onPick: (file: File | undefined) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const t = useTranslations("Products.form");
  const [dragOver, setDragOver] = useState(false);
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    onPick(e.dataTransfer.files?.[0]);
  };
  return (
    <div>
      <input
        {...aria}
        type="file"
        accept={IMAGE_MIME_TYPES.join(",")}
        className="peer sr-only"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={aria.id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-[var(--radius-brand-lg)] border-[1.5px] border-dashed border-[#CFCBC4] p-3 transition-colors hover:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink peer-aria-invalid:border-danger dark:border-[#3a3733]",
          dragOver && "border-accent bg-sand",
        )}
      >
        {current ? (
          <Image
            src={current}
            alt={isNew ? t("newImage") : t("currentImage")}
            width={96}
            height={96}
            unoptimized
            className="size-24 shrink-0 rounded-[var(--radius-brand)] border border-line bg-sand object-cover"
          />
        ) : (
          <span className="grid size-24 shrink-0 place-items-center rounded-[var(--radius-brand)] bg-sand text-muted">
            <ImagePlus className="size-7" strokeWidth={1.8} aria-hidden="true" />
          </span>
        )}
        <span className="grid gap-1">
          <span className="font-bold text-accent-ink">{current ? t("replaceImage") : t("chooseImage")}</span>
          <span className="text-[13px] text-muted">{isNew ? t("newImage") : t("dropZone")}</span>
        </span>
      </label>
    </div>
  );
}

/** Side sheet wrapping the form; `product` null = create. */
export function ProductFormSheet({ open, product, onOpenChange }: { open: boolean; product: Product | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("Products.form");
  const tc = useTranslations("Common");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* the create form has no subtitle; its "no price" note is part of the form */}
      <SheetContent side="end" closeLabel={tc("close")} {...(product ? {} : { "aria-describedby": undefined })}>
        <SheetHeader>
          <SheetTitle>{product ? t("editTitle") : t("createTitle")}</SheetTitle>
          {product && (
            <SheetDescription>
              <span dir="auto">{product.name}</span>
            </SheetDescription>
          )}
        </SheetHeader>
        <ProductForm key={product?.id ?? "new"} product={product} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
