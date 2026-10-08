"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import type { Service, ServiceSection, ServiceTier } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/api/use-error-message";
import { SERVICE_SECTIONS } from "@/lib/services";
import { serviceKeys } from "./queries";

/** How a new service is priced: the columns its row gets. Fixed once created. */
const PRICING = {
  single: { tierSet: undefined, bodySplit: false },
  ppf: { tierSet: "ppf", bodySplit: true },
  tint: { tierSet: "tint", bodySplit: true },
  model: { tierSet: "model", bodySplit: false },
} as const;
type Pricing = keyof typeof PRICING;

function useSave(onDone: () => void) {
  const t = useTranslations("Services");
  const message = useErrorMessage();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const save = async (request: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await request();
      await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success(t("saved"));
      onDone();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

function Footer({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  const tc = useTranslations("Common");
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={saving}>
        {tc("cancel")}
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? tc("saving") : tc("save")}
      </Button>
    </DialogFooter>
  );
}

function ServiceForm({ service, onDone }: { service: Service | null; onDone: () => void }) {
  const t = useTranslations("Services");
  const { saving, save } = useSave(onDone);
  const [nameAr, setNameAr] = useState(service?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(service?.nameEn ?? "");
  const [noteAr, setNoteAr] = useState(service?.noteAr ?? "");
  const [noteEn, setNoteEn] = useState(service?.noteEn ?? "");
  const [section, setSection] = useState<ServiceSection>(service?.section ?? "ppfParts");
  const [pricing, setPricing] = useState<Pricing>("single");
  const [touched, setTouched] = useState(false);
  const short = (value: string) => (touched && value.trim().length < 2 ? t("nameRequired") : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (nameAr.trim().length < 2 || nameEn.trim().length < 2) return;
    void save(() =>
      service
        ? api(`/services/${service.id}`, { method: "PATCH", json: { nameAr, nameEn, noteAr, noteEn } })
        : api("/services", { method: "POST", json: { section, nameAr, nameEn, ...PRICING[pricing] } }),
    );
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("nameAr")} error={short(nameAr)}>
        <Input dir="rtl" maxLength={80} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus />
      </Field>
      <Field label={t("nameEn")} error={short(nameEn)}>
        <Input dir="ltr" maxLength={80} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </Field>
      {service ? (
        <>
          <Field label={t("noteAr")} hint={t("noteHint")} optional>
            <Input dir="rtl" maxLength={200} value={noteAr} onChange={(e) => setNoteAr(e.target.value)} />
          </Field>
          <Field label={t("noteEn")} optional>
            <Input dir="ltr" maxLength={200} value={noteEn} onChange={(e) => setNoteEn(e.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("sectionLabel")}>
            <Select value={section} onValueChange={(v) => setSection(v as ServiceSection)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`section.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("pricingLabel")} hint={t("pricingHint")}>
            <Select value={pricing} onValueChange={(v) => setPricing(v as Pricing)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRICING) as Pricing[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`pricing.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
      <Footer saving={saving} onCancel={onDone} />
    </form>
  );
}

/** Adds a service (its prices start empty), or edits the names and the note of one. */
export function ServiceDialog({ open, service, onClose }: { open: boolean; service: Service | null; onClose: () => void }) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{service ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{service ? t("editBody") : t("addBody")}</DialogDescription>
        </DialogHeader>
        {open && <ServiceForm key={service?.id ?? "new"} service={service} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function TierForm({ tier, onDone }: { tier: ServiceTier; onDone: () => void }) {
  const t = useTranslations("Services");
  const { saving, save } = useSave(onDone);
  const [nameAr, setNameAr] = useState(tier.nameAr);
  const [nameEn, setNameEn] = useState(tier.nameEn);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!nameAr.trim() || !nameEn.trim()) return;
    void save(() => api(`/services/tiers/${tier.id}`, { method: "PATCH", json: { nameAr, nameEn } }));
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("nameAr")}>
        <Input dir="rtl" maxLength={40} value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus />
      </Field>
      <Field label={t("nameEn")}>
        <Input dir="ltr" maxLength={40} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </Field>
      <Footer saving={saving} onCancel={onDone} />
    </form>
  );
}

/** Renames a column: a PPF package, a tint film or a car model. Every service priced by it follows. */
export function TierDialog({ tier, onClose }: { tier: ServiceTier | null; onClose: () => void }) {
  const t = useTranslations("Services");
  const tc = useTranslations("Common");
  return (
    <Dialog open={tier !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("tierTitle")}</DialogTitle>
          <DialogDescription>{t("tierBody")}</DialogDescription>
        </DialogHeader>
        {tier && <TierForm key={tier.id} tier={tier} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
