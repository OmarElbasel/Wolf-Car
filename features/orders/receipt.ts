import { apiRaw } from "@/lib/api/client";
import type { OrderSummary } from "@/lib/api/types";

/** filename from `attachment; filename="receipt-GH-000042.pdf"` (or RFC 5987 filename*=UTF-8''…). */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

/** Downloads the PDF receipt through a temporary object URL (the API needs the bearer token, so no plain link). */
export async function downloadReceipt(order: Pick<OrderSummary, "id" | "code">, locale: "ar" | "en"): Promise<void> {
  const res = await apiRaw(`/orders/${order.id}/receipt`, { query: { locale } });
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? `receipt-${order.code}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // give the browser time to start the download before releasing the blob
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
