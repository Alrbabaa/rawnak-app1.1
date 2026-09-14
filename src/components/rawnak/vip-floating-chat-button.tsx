"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useHasVipAccess } from "@/hooks/use-vip-access";

/**
 * VIP perk: the beauty expert is one tap away from anywhere in the app,
 * not just from the bottom nav's chat tab. Only ever rendered for
 * genuinely active VIP members (see useHasVipAccess) — a real, persistent
 * reminder of what the membership actually unlocks, not just a badge.
 */
export function VipFloatingChatButton() {
  const hasVipAccess = useHasVipAccess();
  const { view, setView, isAuthed, isGuest } = useAppStore();

  // Hidden on the chat screen itself (redundant there) and for
  // guest/unauthenticated sessions (nothing VIP-gated is reachable yet).
  const shouldShow = hasVipAccess && isAuthed && !isGuest && view !== "chat";

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setView("chat")}
          aria-label="استشيري خبيرة الجمال الآن"
          className="fixed left-4 z-40 w-14 h-14 rounded-full rawnak-rosegold-gradient shadow-lg shadow-primary/30 grid place-items-center"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
        >
          <span className="absolute inset-0 rounded-full rawnak-rosegold-gradient animate-ping opacity-30" />
          <span className="relative grid place-items-center">
            <Sparkles className="w-6 h-6 text-black" />
            <Crown className="w-3.5 h-3.5 text-black absolute -top-1.5 -left-1.5" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
