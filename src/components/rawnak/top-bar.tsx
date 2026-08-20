"use client";

import { useAppStore } from "@/lib/store";
import { Moon, Sun, Bell, CheckCheck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "@/lib/format-time";
import { useNotificationCenter } from "@/hooks/use-notification-center";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الجمال";
  if (h < 18) return "نهاركِ إشراق";
  return "مساء الأناقة";
}

export function TopBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const profile = useAppStore((s) => s.profile);
  const streak = useAppStore((s) => s.streak);
  const isAuthed = useAppStore((s) => s.isAuthed);
  const isGuest = useAppStore((s) => s.isGuest);

  // Guests have no server account to fetch notifications for.
  const { notifications, unreadCount, markAllRead } = useNotificationCenter(isAuthed && !isGuest);

  return (
    <header
      className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/rawnak-logo.jpg"
            alt="رَونق"
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl object-cover"
          />
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">{getGreeting()}</p>
            <p className="text-sm font-bold text-foreground">
              {profile.name || "رَونق"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full rawnak-gradient text-foreground text-xs font-bold"
            >
              <span>🔥</span>
              <span>{streak}</span>
            </motion.div>
          )}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-accent transition-colors text-foreground"
            aria-label="تبديل المظهر"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          <Sheet>
            <SheetTrigger asChild>
              <button
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-accent transition-colors text-foreground relative"
                aria-label="الإشعارات"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="top" className="rounded-b-3xl max-h-[75vh] overflow-y-auto pretty-scroll">
              <SheetHeader className="text-right">
                <div className="flex items-center justify-between">
                  <SheetTitle>إشعاراتكِ</SheetTitle>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllRead}
                      className="text-xs gap-1 h-7"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      تمييز الكل كمقروء
                    </Button>
                  )}
                </div>
              </SheetHeader>

              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    ما فيه إشعارات بعد — رَونق بترسلّك كل جديد هنا ✦
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mt-2 pb-4">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-2xl border text-right ${
                        n.read ? "border-border bg-transparent" : "border-primary/30 bg-primary/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-sm">{n.title}</p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                      <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                        {formatDistanceToNow(n.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
