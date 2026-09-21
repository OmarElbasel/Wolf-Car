import type { Transition } from "motion/react";

/** Shared easing/durations so every animated surface feels the same. Kept short and subtle. */
export const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export const fast: Transition = { duration: 0.16, ease: EASE_OUT };
export const base: Transition = { duration: 0.22, ease: EASE_OUT };
export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: fast,
};

export const pop = {
  initial: { opacity: 0, scale: 0.97, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 6 },
  transition: base,
};

/** List items entering/leaving (cart lines, toasts, rows). */
export const listItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
  transition: base,
};
