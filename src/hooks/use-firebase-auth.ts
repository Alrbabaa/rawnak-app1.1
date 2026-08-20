"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAppStore } from "@/lib/store";

/**
 * Firebase's client SDK persists and restores the login session on its own
 * (IndexedDB, survives reloads). Mirrors that state into the app store.
 * Loading the actual profile/analyses/cabinet/etc. data is useDbSync's job
 * (unchanged responsibility, just token-authenticated now).
 *
 * Mounted once in app/page.tsx. No-op for guests.
 */
export function useFirebaseAuthListener() {
  const isGuest = useAppStore((s) => s.isGuest);
  const completeOAuthRedirect = useAppStore((s) => s.completeOAuthRedirect);

  // On Capacitor, signInWithGoogle()/signInWithApple() redirect the whole
  // WebView to the provider and back, which reloads the app. This picks
  // the sign-in back up on that reload — a no-op (resolves to null) on
  // every other load, including web (which uses popups, not redirects).
  useEffect(() => {
    if (isGuest) return;
    completeOAuthRedirect().then((result) => {
      if (!result) return; // not returning from a Google/Apple redirect
      if (!result.ok) {
        toast.error(result.error || "حدث خطأ أثناء تسجيل الدخول");
        return;
      }
      toast.success("مرحبًا بكِ في رَونق ✦");
    });
    // Intentionally run once on mount for OAuth redirects.
  }, []);

  useEffect(() => {
    if (isGuest) return;

    const syncFirebaseUser = useAppStore.getState().syncFirebaseUser;
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        syncFirebaseUser(null, null);
        return;
      }
      // Role comes from the verified ID token's custom claims — the same
      // source /admin/page.tsx and every admin API route trust. Not
      // force-refreshed: a role granted while this exact tab has been open
      // the whole time won't appear until the token's normal ~hourly
      // refresh (or the person signs out and back in) — same trade-off
      // already documented for revokeRefreshTokens on the promotion route.
      let role: "user" | "admin" | "super_admin" | null = null;
      try {
        let tokenResult = await user.getIdTokenResult();
        const claimRole = tokenResult.claims.role;
        if (claimRole === "admin" || claimRole === "super_admin") {
          role = claimRole;
        } else {
          // Check backend for configured admin email or database role
          const idToken = await user.getIdToken();
          const res = await fetch("/api/auth/sync-role", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.role === "admin" || data.role === "super_admin") {
              await user.getIdToken(true);
              role = data.role;
            }
          }
        }
      } catch {
        // Best-effort — role stays null, same as any signed-in non-admin.
      }
      syncFirebaseUser({ uid: user.uid, email: user.email, displayName: user.displayName }, role);
    });

    return () => unsub();
  }, [isGuest]);
}
