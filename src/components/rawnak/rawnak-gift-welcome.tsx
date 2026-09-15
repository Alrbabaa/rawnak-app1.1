"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Gift, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";

/**
 * "أهدي VIP" — the other half of the invite loop. complete-signup/route.ts
 * already grants a real welcome VIP trial (WELCOME_GIFT_TRIAL_MS in
 * referral.ts) to anyone who signs up via a friend's code; this is just
 * the one-time reveal of that gift, so it actually registers as "my
 * friend gave me something" instead of a silent field change she'd never
 * notice. Shown once (giftWelcomeDismissed is local-only, not server
 * truth — the trial itself doesn't depend on this banner ever rendering).
 */
export function RawnakGiftWelcome() {
  const { profile, updateProfile } = useAppStore();

  const stillActive = !!profile.vipTrialExpiresAt && profile.vipTrialExpiresAt > Date.now();
  const shouldShow = !!profile.referredByName && stillActive && !profile.giftWelcomeDismissed;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <Card className="relative overflow-hidden p-4 rounded-2xl border-amber-400/30 rawnak-rosegold-gradient flex items-center gap-3">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
            <div className="relative z-10 w-10 h-10 rounded-full bg-black/10 grid place-items-center shrink-0">
              <Gift className="w-5 h-5 text-black" />
            </div>
            <div className="relative z-10 flex-1 min-w-0">
              <p className="font-bold text-black text-sm">{profile.referredByName} أهدتكِ VIP ✦</p>
              <p className="text-xs text-black/70 mt-0.5">جرّبي كل مميزات VIP الآن — الهدية فعّالة على حسابكِ</p>
            </div>
            <button
              onClick={() => updateProfile({ giftWelcomeDismissed: true })}
              className="relative z-10 w-7 h-7 grid place-items-center rounded-full hover:bg-black/10 shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4 text-black/60" />
            </button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
