"use client";

import type { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { useEffect, useState } from "react";

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

let loader: Promise<ZxcvbnFactory> | null = null;

/**
 * zxcvbn and its dictionaries are large, so they load on the first keystroke
 * (a separate chunk) instead of with the page. One instance is shared.
 */
export function loadZxcvbn(): Promise<ZxcvbnFactory> {
  if (!loader) {
    loader = Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ]).then(
      ([core, common, en]) =>
        new core.ZxcvbnFactory({
          dictionary: { ...common.dictionary, ...en.dictionary },
          graphs: common.adjacencyGraphs,
          translations: en.translations,
          useLevenshteinDistance: true,
        }),
    );
    // a failed chunk load (flaky network) may be retried on the next keystroke
    loader.catch(() => {
      loader = null;
    });
  }
  return loader;
}

/** zxcvbn score (0–4) for the password, or null while empty / not loaded yet. */
export function usePasswordStrength(password: string, userInputs: readonly string[]): StrengthScore | null {
  const [result, setResult] = useState<{ password: string; score: StrengthScore } | null>(null);
  const inputs = userInputs.filter(Boolean).join("\n");

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    loadZxcvbn()
      .then((zxcvbn) => {
        if (!cancelled) setResult({ password, score: zxcvbn.check(password, inputs ? inputs.split("\n") : []).score });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [password, inputs]);

  // keep showing the previous score for the moment the new one is computed
  return password && result ? result.score : null;
}
