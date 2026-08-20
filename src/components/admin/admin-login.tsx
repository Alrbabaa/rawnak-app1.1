"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { firebaseAuthErrorMessage } from "@/lib/firebase/error-messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin status is a Firebase Custom Claim (set externally via
 * scripts/set-admin-claim.js), not a secret entered here. This form is
 * just a normal email/password sign-in; admin/page.tsx watches Firebase's
 * own auth state afterward and checks the claim itself.
 */
export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("الرجاء إدخال البريد وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (userCred.user) {
        const idToken = await userCred.user.getIdToken();
        const res = await fetch("/api/auth/sync-role", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          await userCred.user.getIdToken(true);
        }
      }
    } catch (err) {
      toast.error(firebaseAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card rawnak-shadow rounded-3xl overflow-hidden">
          <CardHeader className="items-center text-center pb-2">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                <img
                  src="/rawnak-logo.jpg"
                  alt="رَونق"
                  className="w-16 h-16 rounded-2xl object-cover rawnak-shadow"
                />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full rawnak-rosegold-gradient flex items-center justify-center rawnak-shadow">
                  <ShieldCheck className="w-3.5 h-3.5 text-black" />
                </div>
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold rawnak-gold-text">لوحة تحكم رَونق</h1>
                <p className="text-sm text-muted-foreground">دخول المسؤول</p>
              </div>
            </motion.div>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm font-medium">
                  البريد الإلكتروني
                </Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    placeholder="admin@rawnak.app"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-9 text-right"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-sm font-medium">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    dir="ltr"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-9 text-right"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rawnak-rosegold-gradient text-black font-semibold hover:opacity-90 rounded-xl h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ الدخول...
                  </>
                ) : (
                  "دخول اللوحة"
                )}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground/70 text-center mt-4 leading-relaxed">
              هذا الحساب يجب أن يملك صلاحية أدمن مُعيَّنة مسبقًا. يُسجَّل كل دخول وكل عملية في النظام.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
