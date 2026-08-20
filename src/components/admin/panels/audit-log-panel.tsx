"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, RefreshCw, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/components/admin/admin-types";

interface AuditEntry {
  id: string;
  adminEmail: string;
  action: "create" | "update" | "delete" | "publish" | "unpublish" | "login";
  resource: string;
  resourceId: string | null;
  resourceLabel: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: number;
}

const ACTION_META: Record<AuditEntry["action"], { label: string; icon: typeof Plus; className: string }> = {
  create: { label: "إنشاء", icon: Plus, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  update: { label: "تعديل", icon: Pencil, className: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  delete: { label: "حذف", icon: Trash2, className: "text-destructive bg-destructive/10 border-destructive/30" },
  publish: { label: "نشر", icon: Eye, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  unpublish: { label: "إخفاء", icon: EyeOff, className: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  login: { label: "دخول", icon: Eye, className: "text-muted-foreground bg-muted" },
};

const RESOURCE_LABELS: Record<string, string> = {
  picks: "اختيارات رَونق",
  settings: "الإعدادات",
  "referral-reconcile": "مطابقة الإحالات",
};

interface AuditLogPanelProps {
  email: string;
}

/**
 * Currently only /api/admin/picks (create/update/delete/publish) writes
 * audit entries — it's the reference instrumentation. Extending the same
 * logAdminAction() call to the other admin routes (articles, videos,
 * partners…) is a mechanical follow-up, not a redesign.
 */
export function AuditLogPanel({ email }: AuditLogPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/admin/audit-log?resource=${resource}`);
      const json = await res.json();
      if (res.ok) setEntries(json.entries || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [email, resource]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text flex items-center gap-2">
            <FileText className="w-6 h-6" />
            سجل العمليات
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            من فعل ماذا ومتى — كل عملية إنشاء/تعديل/حذف/نشر تُسجَّل تلقائيًا
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={resource} onValueChange={setResource}>
            <SelectTrigger className="rounded-xl w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {Object.entries(RESOURCE_LABELS).map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="rounded-xl gap-1.5">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
        </div>
      </div>

      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا توجد عمليات مسجّلة بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {entries.map((e, i) => {
                const meta = ACTION_META[e.action] || ACTION_META.update;
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="flex items-center gap-3 p-3.5 hover:bg-accent/30 transition-colors"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                        meta.className
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-bold">{e.adminEmail}</span>
                        <span className="text-muted-foreground"> — {meta.label} </span>
                        <span className="font-medium">
                          {RESOURCE_LABELS[e.resource] || e.resource}
                        </span>
                        {e.resourceLabel && (
                          <span className="text-muted-foreground"> · {e.resourceLabel}</span>
                        )}
                      </p>
                      {e.ip && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5" dir="ltr">
                          {e.ip}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDate(String(e.createdAt))}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
