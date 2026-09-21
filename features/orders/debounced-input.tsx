"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Text input that reports its (trimmed) value only after typing pauses.
 * Follows `value` when it changes from outside (e.g. "Clear filters").
 */
export function DebouncedInput({
  value,
  onValueChange,
  delay = 300,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & { value: string; onValueChange: (value: string) => void; delay?: number }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const [emitted, setEmitted] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (value !== seen) {
    setSeen(value);
    // our own emitted value coming back must not overwrite what the user kept typing
    if (value !== emitted) setText(value);
  }

  useEffect(() => {
    const pending = timer;
    return () => clearTimeout(pending.current);
  }, []);

  return (
    <Input
      {...props}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const trimmed = next.trim();
          setEmitted(trimmed);
          onValueChange(trimmed);
        }, delay);
      }}
    />
  );
}
