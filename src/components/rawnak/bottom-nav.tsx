"use client";

import { useAppStore, type View } from "@/lib/store";
import { Home, MessageCircleHeart, UserRound, GraduationCap, Sparkles, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { view: View; label: string; icon: typeof Home }[] = [
  { view: "home", label: "الرئيسية", icon: Home },
  { view: "academy", label: "الأكاديمية", icon: GraduationCap },
  { view: "picks", label: "المنتجات", icon: ShoppingBag },
  { view: "chat", label: "المساعد", icon: MessageCircleHeart },
  { view: "cabinet", label: "خزانتي", icon: Sparkles },
  { view: "profile", label: "حسابي", icon: UserRound },
];

export function BottomNav() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  // Map sub-views to their parent tab for highlighting. "picks" used to be
  // grouped under "academy" here, which is why the products section never
  // had a real home in navigation — it now gets its own tab above, so it's
  // no longer grouped with anything.
  const activeTab: View =
    view === "results" || view === "scanner" || view === "journey"
      ? "home"
      : view === "articles" || view === "library"
      ? "academy"
      : view === "products" ||
        view === "achievements" ||
        view === "compare" ||
        view === "planner" ||
        view === "timeline" ||
        view === "about"
      ? "profile"
      : view;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl"
      aria-label="التنقل الرئيسي"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-2xl px-2">
        <ul className="flex items-stretch justify-around h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.view;
            return (
              <li key={item.view} className="flex-1">
                <button
                  onClick={() => setView(item.view)}
                  className="w-full h-full flex flex-col items-center justify-center gap-1 relative group"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  <span className="relative grid place-items-center w-11 h-8">
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full glass-card rawnak-glow"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "relative w-5 h-5 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[11px] transition-colors",
                      isActive
                        ? "text-primary font-bold"
                        : "text-muted-foreground font-medium group-hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
