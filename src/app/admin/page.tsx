"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

interface AdminSession {
  email: string;
  name: string;
  role: "admin" | "super_admin";
}

/**
 * Role comes straight from the verified ID token's custom claims via
 * getIdTokenResult(). If someone already signed in via the main app in
 * this browser, Firebase Auth state is shared site-wide — they land
 * straight in the dashboard without logging in again here.
 */
export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setSession(null);
        setReady(true);
        return;
      }
      try {
        let tokenResult = await user.getIdTokenResult();
        let role = tokenResult.claims.role as "admin" | "super_admin" | undefined;

        if (!role) {
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

        if (role === "admin" || role === "super_admin") {
          setSession({ email: user.email || "", name: user.displayName || user.email || "", role });
        } else {
          setSession(null);
        }
      } catch {
        setSession(null);
      }
      setReady(true);
    });
    return () => unsub();
  }, []);

  function handleLogout() {
    signOut(firebaseAuth).catch(() => {});
    setSession(null);
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AdminLogin />;
  }

  return (
    <AdminDashboard email={session.email} name={session.name} role={session.role} onLogout={handleLogout} />
  );
}
