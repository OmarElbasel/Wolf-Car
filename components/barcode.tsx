import { code128Svg, isCode128Encodable } from "@/shared/code128";
import { cn } from "@/lib/utils";

/**
 * A scannable CODE128 barcode. The markup comes from a pure encoder shared
 * with the PDF receipt, so what the cashier scans off the screen and off the
 * printed sheet are the same bars.
 *
 * Falls back to the plain code when the value cannot be encoded (CODE128
 * covers printable ASCII only, and one legacy row holds Arabic text).
 */
export function Barcode({
  value,
  height = 44,
  moduleWidth = 1.6,
  showLabel = true,
  className,
}: {
  value: string | null | undefined;
  height?: number;
  moduleWidth?: number;
  showLabel?: boolean;
  className?: string;
}) {
  if (!value) return null;

  if (!isCode128Encodable(value)) {
    return (
      <span dir="ltr" className={cn("font-mono text-[13px] text-muted", className)}>
        {value}
      </span>
    );
  }

  return (
    <span
      dir="ltr"
      className={cn("inline-block text-ink", className)}
      // safe: the encoder emits a fixed shape and XML-escapes the caption
      dangerouslySetInnerHTML={{ __html: code128Svg(value, { height, moduleWidth, showLabel }) }}
    />
  );
}
