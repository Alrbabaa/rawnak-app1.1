"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Sparkles, ArrowLeft, Tag } from "lucide-react";
import { toast } from "sonner";

export function AuthScreen() {
  const signup = useAppStore((s) => s.signup);
  const login = useAppStore((s) => s.login);
  const signInWithGoogle = useAppStore((s) => s.signInWithGoogle);
  const signInWithApple = useAppStore((s) => s.signInWithApple);
  const loginAsGuest = useAppStore((s) => s.loginAsGuest);
  const pendingReferralCode = useAppStore((s) => s.pendingReferralCode);
  const pendingAuthMode = useAppStore((s) => s.pendingAuthMode);
  const [mode, setMode] = useState<"login" | "signup">(pendingAuthMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(pendingReferralCode || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("يرجى إدخال البريد وكلمة المرور");
      return;
    }
    if (mode === "signup" && password.trim().length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setLoading(true);
    const result =
      mode === "signup"
        ? await signup(email.trim(), password.trim(), name.trim(), referralCode.trim() || undefined)
        : await login(email.trim(), password.trim());
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error || "حدث خطأ ما");
      return;
    }
    toast.success("مرحبًا بكِ في رَونق ✦");
  };

  const handleGoogle = async () => {
    setLoading(true);
    // Same referral code the email/password signup form uses — Google
    // doesn't distinguish "signup" vs "login" up front, so it's always
    // passed; /api/auth/complete-signup only applies it the first time a
    // given account is created and is a no-op on every later sign-in.
    const result = await signInWithGoogle(referralCode.trim() || undefined);
    if (result.pending) {
      // Capacitor: the WebView is navigating away to Google right now.
      // Leave `loading` true — the screen is about to unmount anyway.
      return;
    }
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error || "حدث خطأ ما");
      return;
    }
    toast.success("مرحبًا بكِ في رَونق ✦");
  };

  const handleApple = async () => {
    setLoading(true);
    const result = await signInWithApple(referralCode.trim() || undefined);
    if (result.pending) {
      // Capacitor: the WebView is navigating away to Apple right now.
      // Leave `loading` true — the screen is about to unmount anyway.
      return;
    }
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error || "حدث خطأ ما");
      return;
    }
    toast.success("مرحبًا بكِ في رَونق ✦");
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      {/* Decorative */}
      <div className="absolute top-0 inset-x-0 h-72 rawnak-gradient overflow-hidden">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.5 }}
          transition={{ duration: 1.2 }}
          className="absolute -top-10 -right-10 w-60 h-60 rounded-full blur-3xl"
          style={{ background: "oklch(0.78 0.09 70 / 0.4)" }}
        />
      </div>

      <div
        className="relative z-10 min-h-screen flex flex-col items-center px-6 pb-10"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)",
        }}
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center mb-8"
        >
          <img
            src="/rawnak-logo.jpg"
            alt="رَونق"
            width={80}
            height={80}
            className="w-20 h-20 rounded-2xl object-cover rawnak-glow"
          />
          <h1 className="mt-4 text-4xl font-extrabold rawnak-gold-text">رَونق</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            صوّري بشرتكِ، واحصلي على تحليل ذكاء اصطناعي فوري وروتين عناية مخصص لكِ
          </p>
        </motion.div>

        {/* What she gets, before asking for an account — a first-time
            visitor has no other context for what رَونق does; three
            concrete outcomes (not feature names) read faster than the
            tagline alone and cost her nothing to skim before deciding to
            sign up. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full max-w-md grid grid-cols-3 gap-2 mb-6"
        >
          {[
            { icon: "📸", t: "تحليل بشرة فوري بالذكاء الاصطناعي" },
            { icon: "💬", t: "خبيرة جمال تجاوبكِ في أي وقت" },
            { icon: "✦", t: "روتين يومي مخصص لبشرتكِ" },
          ].map((f) => (
            <div
              key={f.t}
              className="flex flex-col items-center text-center gap-1.5 p-3 rounded-2xl bg-card border border-border"
            >
              <span className="text-xl">{f.icon}</span>
              <span className="text-[10px] font-semibold leading-tight text-foreground">{f.t}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-3xl p-6 rawnak-shadow">
            <div className="flex gap-2 p-1 rounded-2xl bg-muted/60 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  mode === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                حساب جديد
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">الاسم</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمكِ الجميل"
                    className="h-12 rounded-xl bg-background"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12 rounded-xl bg-background pr-10"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-xl bg-background pr-10"
                    dir="ltr"
                  />
                </div>
              </div>

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="referral">
                    رمز إحالة <span className="text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <div className="relative">
                    <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="referral"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="مثال: SALMA-2X9K"
                      className="h-12 rounded-xl bg-background pr-10 uppercase"
                      dir="ltr"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl rawnak-rose-gradient text-white font-bold text-base shadow-lg disabled:opacity-60"
              >
                {loading ? (
                  <Sparkles className="w-5 h-5 animate-pulse" />
                ) : mode === "login" ? (
                  "ادخلي عالم الجمال"
                ) : (
                  "ابدئي رحلتك"
                )}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              onClick={handleGoogle}
              disabled={loading}
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold bg-background"
            >
              <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              المتابعة عبر Google
            </Button>

            <Button
              onClick={handleApple}
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold bg-black text-white hover:bg-black/90 mt-2.5"
            >
              <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.365 1.43c0 1.14-.463 2.209-1.222 3.001-.858.892-2.19 1.575-3.318 1.483-.145-1.086.42-2.238 1.208-2.98.86-.812 2.32-1.412 3.332-1.504zm4.615 16.65c-.494 1.14-.73 1.65-1.365 2.66-.888 1.41-2.14 3.17-3.694 3.184-1.38.013-1.735-.9-3.606-.888-1.87.012-2.26.902-3.64.889-1.554-.014-2.738-1.6-3.626-3.01-2.488-3.933-2.75-8.548-1.213-11.006 1.09-1.744 2.813-2.766 4.435-2.766 1.65 0 2.688.907 4.055.907 1.325 0 2.13-.909 4.032-.909 1.446 0 2.978.788 4.07 2.15-3.578 1.96-2.998 7.07.552 8.789z" />
              </svg>
              المتابعة عبر Apple
            </Button>
          </div>

          <button
            onClick={() => {
              loginAsGuest();
              toast("تجربة كضيفة ✦", {
                description: "بياناتكِ محفوظة على هذا الجهاز فقط ولن تُزامَن — أنشئي حسابًا لاحقًا للحفظ الدائم",
              });
            }}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
          >
            تصفّح كضيفة
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground max-w-xs">
          بتسجيل الدخول، أنتِ توافقين على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
