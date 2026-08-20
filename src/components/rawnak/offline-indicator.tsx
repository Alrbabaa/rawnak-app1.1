"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

/**
 * Shows a banner when the device goes offline.
 * Pairs with the offline queue to keep mutations until reconnect.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-black text-center py-1.5 text-xs font-bold flex items-center justify-center gap-1.5"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          وضع عدم الاتصال — ستُحفظ تغييراتكِ وتُزامن لاحقًا
        </motion.div>
      )}
    </AnimatePresence>
  );
}
