"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  LayoutDashboard,
  Sparkles,
  Video,
  Newspaper,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  Handshake,
  FileText,
  Settings as SettingsIcon,
  ChevronLeft,
  Headset,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommandCenterPanel } from "@/components/admin/panels/command-center-panel";
import { OverviewPanel } from "@/components/admin/panels/overview-panel";
import { PicksPanel } from "@/components/admin/panels/picks-panel";
import { VideosPanel } from "@/components/admin/panels/videos-panel";
import { ArticlesPanel } from "@/components/admin/panels/articles-panel";
import { UsersPanel } from "@/components/admin/panels/users-panel";
import { AnalyticsPanel } from "@/components/admin/panels/analytics-panel";
import { ReferralPartnersPanel } from "@/components/admin/panels/referral-partners-panel";
import { PartnerDiscountCardsPanel } from "@/components/admin/panels/partner-discount-cards-panel";
import { AuditLogPanel } from "@/components/admin/panels/audit-log-panel";
import { SupportPanel } from "@/components/admin/panels/support-panel";
import { ReportsPanel } from "@/components/admin/panels/reports-panel";
import { SettingsPanel } from "@/components/admin/panels/settings-panel";
import { Gift } from "lucide-react";
import { authedFetch } from "@/lib/firebase/authed-fetch";

interface AdminDashboardProps {
  email: string;
  name: string;
  role: "admin" | "super_admin";
  onLogout: () => void;
}

type TabId =
  | "command_center"
  | "overview"
  | "picks"
  | "videos"
  | "articles"
  | "users"
  | "analytics"
  | "partnerCards"
  | "referrals"
  | "support"
  | "reports"
  | "audit_log"
  | "settings";

interface NavItem {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
  minRole?: "super_admin";
}

// Grouped to mirror رَونق's own business flow: المستخدم → التحليل →
// المحتوى/المنتج → الشريك → القياس — plus a dedicated "الإدارة والنظام"
// group for what was explicitly missing (سجل العمليات، الإعدادات).
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "القيادة",
    items: [
      { id: "command_center", label: "مركز القيادة", icon: Compass },
      { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
    ],
  },
  {
    title: "المستخدمون والقياس",
    items: [
      { id: "users", label: "المستخدمون", icon: Users },
      { id: "support", label: "الدعم", icon: Headset },
      { id: "reports", label: "البلاغات", icon: Flag },
      { id: "analytics", label: "التحليلات", icon: BarChart3 },
    ],
  },
  {
    title: "المحتوى والمنتجات",
    items: [
      { id: "picks", label: "اختيارات رَونق", icon: Sparkles },
      { id: "videos", label: "أكاديمية الجمال", icon: Video },
      { id: "articles", label: "المقالات", icon: Newspaper },
    ],
  },
  {
    title: "التجارة والشركاء",
    items: [
      { id: "partnerCards", label: "بطاقات الشركاء", icon: Gift },
      { id: "referrals", label: "إحالات الشركاء", icon: Handshake, minRole: "super_admin" },
    ],
  },
  {
    title: "الإدارة والنظام",
    items: [
      { id: "audit_log", label: "سجل العمليات", icon: FileText, minRole: "super_admin" },
      { id: "settings", label: "الإعدادات", icon: SettingsIcon },
    ],
  },
];

export function AdminDashboard({ email, name, role, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("command_center");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    authedFetch("/api/admin/support")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const count = (j?.threads || []).filter((t: { unreadForAdmin?: boolean }) => t.unreadForAdmin).length;
        setSupportUnreadCount(count);
      })
      .catch(() => {});
    return () => { active = false; };
    // Re-checked whenever the support tab is left, so the badge clears
    // once its threads have actually been opened and marked read there.
  }, [activeTab]);

  function NavButton({ item }: { item: NavItem }) {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        onClick={() => {
          setActiveTab(item.id);
          setMobileNavOpen(false);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all",
          active
            ? "rawnak-rosegold-gradient text-black shadow-md"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        <Icon className={cn("w-4 h-4", active ? "text-black" : "")} />
        <span className="flex-1 text-right">{item.label}</span>
        {item.id === "support" && supportUnreadCount > 0 && (
          <span className="min-w-4.5 h-4.5 px-1 grid place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {supportUnreadCount}
          </span>
        )}
        {active && <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 glass-card border-b border-border/50 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg hover:bg-accent/50 transition-colors"
              aria-label="القائمة"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <img
              src="/rawnak-logo.jpg"
              alt="رَونق"
              className="w-9 h-9 rounded-xl object-cover"
            />
            <div className="hidden sm:block">
              <h1 className="text-base font-bold rawnak-gold-text leading-tight">
                لوحة تحكم رَونق
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                مركز التشغيل والتحكم الكامل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs text-muted-foreground">مرحبًا،</span>
              <span className="text-sm font-medium">{name || (email ? email.split("@")[0] : "مسؤول")}</span>
            </div>
            <div className="w-9 h-9 rounded-full rawnak-gradient flex items-center justify-center text-sm font-bold text-foreground">
              {(name || email || "R").charAt(0).toUpperCase()}
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar (right side in RTL) */}
        <aside
          className={cn(
            "fixed lg:sticky top-16 right-0 z-20 w-64 shrink-0 h-[calc(100vh-4rem)]",
            "bg-sidebar/80 backdrop-blur-xl border-l border-border/50",
            "transition-transform duration-300 lg:translate-x-0",
            mobileNavOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="p-3 space-y-4 overflow-y-auto h-full pretty-scroll">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter((item) => !item.minRole || item.minRole === role);
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.title} className="space-y-1">
                  <div className="px-2.5 py-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                      {group.title}
                    </span>
                  </div>
                  {visibleItems.map((item) => (
                    <NavButton key={item.id} item={item} />
                  ))}
                </div>
              );
            })}
            <div className="pt-4 mt-4 border-t border-border/40">
              <div className="px-3 py-2 rounded-xl glass-card text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">رَونق · المسؤول</p>
                <p>تأكدي من حفظ التغييرات قبل الخروج.</p>
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden fixed inset-0 top-16 z-10 bg-black/60 backdrop-blur-sm"
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "command_center" && (
                <CommandCenterPanel email={email} onNavigate={(t) => setActiveTab(t as TabId)} />
              )}
              {activeTab === "overview" && <OverviewPanel email={email} />}
              {activeTab === "picks" && <PicksPanel email={email} />}
              {activeTab === "partnerCards" && <PartnerDiscountCardsPanel email={email} />}
              {activeTab === "videos" && <VideosPanel email={email} />}
              {activeTab === "articles" && <ArticlesPanel email={email} />}
              {activeTab === "users" && <UsersPanel email={email} viewerRole={role} />}
              {activeTab === "support" && <SupportPanel viewerRole={role} />}
              {activeTab === "reports" && <ReportsPanel email={email} />}
              {activeTab === "analytics" && <AnalyticsPanel email={email} />}
              {activeTab === "referrals" && role === "super_admin" && (
                <ReferralPartnersPanel email={email} />
              )}
              {activeTab === "audit_log" && role === "super_admin" && (
                <AuditLogPanel email={email} />
              )}
              {activeTab === "settings" && <SettingsPanel email={email} viewerRole={role} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
