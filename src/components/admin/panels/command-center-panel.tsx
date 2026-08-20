"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Compass, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandCenterData {
  alerts: { level: "info" | "warning"; text: string }[];
  health: "green" | "yellow";
  stats: {
    newUsersToday: number;
    picksNoPhoto: number;
    draftPicks: number;
    totalPicks: number;
    publishedPicks: number;
  };
}

interface CommandCenterPanelProps {
  email: string;
  onNavigate: (tab: string) => void;
}

const TODAY = new Date().toLocaleDateString("ar", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function CommandCenterPanel({ email, onNavigate }: CommandCenterPanelProps) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/command-center");
        const json = await res.json();
        if (active && res.ok) setData(json);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [email]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold rawnak-gold-text flex items-center gap-2">
          <Compass className="w-6 h-6" />
          مركز القيادة
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{TODAY}</p>
      </div>

      {/* Health */}
      <Card
        className={cn(
          "glass-card rounded-2xl border",
          data.health === "green" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
        )}
      >
        <CardContent className="p-4 flex items-center gap-3">
          {data.health === "green" ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          )}
          <p className="font-bold text-sm">
            {data.health === "green" ? "النظام يعمل طبيعيًا" : "تحذيرات تحتاج مراجعة"}
          </p>
        </CardContent>
      </Card>

      {/* Alerts */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground mb-2 px-1">الأحداث المهمة اليوم</h3>
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                onClick={() => {
                  if (a.text.includes("مسودة") || a.text.includes("صورة")) onNavigate("picks");
                }}
                className={cn(
                  "glass-card rounded-xl border cursor-pointer hover:border-primary/40 transition-colors",
                  a.level === "warning" ? "border-amber-500/25" : "border-border/50"
                )}
              >
                <CardContent className="p-3 flex items-center gap-2.5">
                  {a.level === "warning" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <p className="text-sm">{a.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "مستخدمات جديدة اليوم", value: data.stats.newUsersToday },
          { label: "إجمالي المنتجات", value: data.stats.totalPicks },
          { label: "منتجات منشورة", value: data.stats.publishedPicks },
          { label: "مسودات بانتظار المراجعة", value: data.stats.draftPicks },
        ].map((s) => (
          <Card key={s.label} className="glass-card rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold rawnak-gold-text">{s.value.toLocaleString("ar-EG")}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        لمزيد من التفاصيل والرسوم البيانية، انتقلي إلى «نظرة عامة» أو «التحليلات» من القائمة
      </p>
    </div>
  );
}
