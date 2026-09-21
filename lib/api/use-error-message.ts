"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { errorMessage } from "./errors";

/** Translated message for any error thrown by the API client. */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations();
  return useCallback((error: unknown) => errorMessage(error, t, (key) => t.has(key)), [t]);
}
