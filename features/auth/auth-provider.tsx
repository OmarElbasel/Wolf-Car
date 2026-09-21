"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type Audience,
  hasSessionHint,
  logoutSession,
  onSessionExpired,
  publicPost,
  refreshSession,
  setAccessToken,
} from "@/lib/api/client";
import type { AuthResult, PermissionKey, Profile, TwoFactorChallenge } from "@/lib/api/types";

type Status = "loading" | "authenticated" | "anonymous";
/** Why the session ended; decides the message on the login page. */
export type EndReason = "expired" | "signedOut" | "password";

interface AuthApi {
  status: Status;
  user: Profile | null;
  /** Set once the session ends in this tab; null while signed in or never signed in. */
  endReason: EndReason | null;
  /** UX only — the API enforces every permission itself. */
  can: (permission: PermissionKey) => boolean;
  canAny: (...permissions: PermissionKey[]) => boolean;
  login: (username: string, password: string) => Promise<Profile | TwoFactorChallenge>;
  verifyTwoFactor: (challengeToken: string, second: { code: string } | { recoveryCode: string }) => Promise<Profile>;
  logout: () => Promise<void>;
  /** Re-reads the profile (e.g. after enabling 2FA). */
  reload: () => Promise<void>;
  /** Clears the local session after the server revoked it (e.g. password change). */
  expire: (reason?: EndReason) => void;
}

const AuthContext = createContext<AuthApi | null>(null);

const PATHS: Record<Audience, { login: string; twoFactor: string }> = {
  dashboard: { login: "/auth/login", twoFactor: "/auth/login/2fa" },
  showroom: { login: "/auth/showroom/login", twoFactor: "" },
};

/**
 * Session state for one audience (dashboard or showroom). On mount it tries
 * the refresh cookie, so a reload keeps the user signed in without ever
 * storing a token in JavaScript-readable storage.
 */
export function AuthProvider({ audience, children }: { audience: Audience; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<Profile | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);

  const accept = useCallback(
    (result: AuthResult) => {
      setAccessToken(audience, result.accessToken);
      setUser(result.user);
      setEndReason(null);
      setStatus("authenticated");
      return result.user;
    },
    [audience],
  );

  const expire = useCallback(
    (reason: EndReason = "expired") => {
      setAccessToken(audience, null);
      setUser(null);
      setEndReason(reason);
      setStatus("anonymous");
      queryClient.clear();
    },
    [audience, queryClient],
  );

  useEffect(() => {
    let cancelled = false;
    const restore = hasSessionHint(audience) ? refreshSession(audience) : Promise.resolve(null);
    void restore.then((result) => {
      if (cancelled) return;
      if (result) accept(result);
      else setStatus("anonymous");
    });
    const stop = onSessionExpired((a) => {
      if (a === audience) expire();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [audience, accept, expire]);

  const api = useMemo<AuthApi>(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      status,
      user,
      endReason,
      can: (p) => permissions.has(p),
      canAny: (...ps) => ps.some((p) => permissions.has(p)),
      login: async (username, password) => {
        const result = await publicPost<AuthResult | TwoFactorChallenge>(PATHS[audience].login, { username, password });
        return "twoFactorRequired" in result ? result : accept(result);
      },
      verifyTwoFactor: async (challengeToken, second) =>
        accept(await publicPost<AuthResult>(PATHS[audience].twoFactor, { challengeToken, ...second })),
      logout: async () => {
        await logoutSession(audience);
        expire("signedOut");
      },
      reload: async () => {
        const result = await refreshSession(audience);
        if (result) accept(result);
        else expire();
      },
      expire,
    };
  }, [status, user, endReason, audience, accept, expire]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

/**
 * Fixed session for component tests and previews: `user` is signed in, actions
 * are no-ops unless overridden. Never used by the running app.
 */
export function StaticAuthProvider({
  user,
  overrides = {},
  children,
}: {
  user: Profile | null;
  overrides?: Partial<AuthApi>;
  children: ReactNode;
}) {
  const permissions = new Set(user?.permissions ?? []);
  const value: AuthApi = {
    status: user ? "authenticated" : "anonymous",
    user,
    endReason: null,
    can: (p) => permissions.has(p),
    canAny: (...ps) => ps.some((p) => permissions.has(p)),
    login: async () => {
      throw new Error("login not available in StaticAuthProvider");
    },
    verifyTwoFactor: async () => {
      throw new Error("verifyTwoFactor not available in StaticAuthProvider");
    },
    logout: async () => undefined,
    reload: async () => undefined,
    expire: () => undefined,
    ...overrides,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Renders children only when the signed-in user has the permission(s). UX only. */
export function Can({
  permission,
  any,
  children,
  fallback = null,
}: {
  permission?: PermissionKey;
  any?: PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, canAny } = useAuth();
  const allowed = (permission ? can(permission) : true) && (any ? canAny(...any) : true);
  return <>{allowed ? children : fallback}</>;
}
