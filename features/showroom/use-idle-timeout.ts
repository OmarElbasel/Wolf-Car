"use client";

import { useEffect, useEffectEvent } from "react";

/** A customer who walks away leaves the tablet idle; the cart is cleared after this long. */
export const IDLE_TIMEOUT_MS = 3 * 60_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Calls `onIdle` once there has been no pointer/keyboard activity for
 * `timeoutMs` while `enabled`. Any activity restarts the countdown.
 */
export function useIdleTimeout(enabled: boolean, onIdle: () => void, timeoutMs: number = IDLE_TIMEOUT_MS): void {
  const fire = useEffectEvent(() => onIdle());

  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => fire(), timeoutMs);
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fire(), timeoutMs);
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, restart, { capture: true, passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, restart, { capture: true });
    };
  }, [enabled, timeoutMs]);
}
