import type { SiteEventType } from "@/shared/analytics";

/**
 * Anonymous visitor statistics for the public website: what was opened and
 * which contact buttons were pressed. No cookie, nothing kept in the browser
 * beyond "this tab already counted its first page", and the page never waits
 * for the answer.
 */
const ENDPOINT = "/api/public/events";
/** set once per tab, so only the first page of a visit carries where the visitor came from */
const VISIT_KEY = "wolfcar.visit";
const STAFF = /^\/(ar|en)\/(dashboard|login|showroom|slots)(\/|$)/;

export interface TrackDetails {
  /** the branch for a contact press, the product for an add to cart, the car for a model view */
  label?: string;
  targetId?: string;
}

function firstPageOfVisit(): boolean {
  try {
    if (window.sessionStorage.getItem(VISIT_KEY)) return false;
    window.sessionStorage.setItem(VISIT_KEY, "1");
    return true;
  } catch {
    // storage blocked: every page then counts as a visit of its own, never as none
    return true;
  }
}

function externalReferrer(): string | undefined {
  const referrer = document.referrer;
  if (!referrer) return undefined;
  try {
    return new URL(referrer).host === window.location.host ? undefined : referrer.slice(0, 500);
  } catch {
    return undefined;
  }
}

export function track(type: SiteEventType, details: TrackDetails = {}): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (STAFF.test(path)) return;

  const body: Record<string, unknown> = { type, path: path.slice(0, 300) };
  if (details.label) body.label = details.label.slice(0, 160);
  if (details.targetId && /^[A-Za-z0-9_-]{1,64}$/.test(details.targetId)) body.targetId = details.targetId;
  if (type === "pageview" && firstPageOfVisit()) {
    body.entry = true;
    const referrer = externalReferrer();
    if (referrer) body.referrer = referrer;
    const campaign = new URLSearchParams(window.location.search).get("utm_source")?.trim();
    if (campaign) body.campaign = campaign.slice(0, 40);
  }

  try {
    // keepalive: the request survives the page being left for WhatsApp or the dialler
    void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(
      () => undefined,
    );
  } catch {
    /* statistics never get in the visitor's way */
  }
}
