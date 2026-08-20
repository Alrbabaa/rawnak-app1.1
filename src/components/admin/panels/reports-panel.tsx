"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag, Loader2, RefreshCw, CheckCircle2, XCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/components/admin/admin-types";

interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reason: "harassment" | "impersonation" | "inappropriate_content" | "spam" | "other";
  note: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  adminNote?: string;
}

const REASON_LABEL: Record<Report["reason"], string> = {
  harassment: "مضايقة أو تحرش",
  impersonation: "انتحال شخصية",
  inappropriate_content: "محتوى غير لائق",
  spam: "إزعاج / سبام",
  other: "سبب آخر",
};

const STATUS_FILTERS: { id: "open" | "resolved" | "dismissed" | "all"; label: string }[] = [
  { id: "open", label: "قيد المراجعة" },
  { id: "resolved", label: "تم اتخاذ إجراء" },
  { id: "dismissed", label: "مرفوضة" },
  { id: "all", label: "الكل" },
];

/**
 * "البلاغات" — the human-review side of App Store Review Guideline 1.2.
 * Users flag accounts from the public-profile menu (see
 * public-profile-modal.tsx → /api/social/report); this is where an admin
 * actually looks at each one and closes it out as either "resolved"
 * (action was taken — e.g. the user was warned or handled from Users
 * panel) or "dismissed" (no action needed). Reviewers checking Guideline
 * 1.2 compliance will generally expect to see exactly this: a queue, a
 * reason, and a closeable status — not just that reports get stored.
 */
export function ReportsPanel({ email }: { email: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [actingId, setActingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    authedFetch("/api/admin/reports")
      .then((r) => r.json())
      .then((json) => setReports(Array.isArray(json?.reports) ? json.reports : []))
      .catch(() => toast.error("تعذّر تحميل البلاغات"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const handleAction = async (report: Report, status: "resolved" | "dismissed") => {
    setActingId(report.id);
    try {
      const res = await authedFetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: noteDrafts[report.id] || "" }),
      });
      if (!res.ok) throw new Error();
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status, reviewedBy: email, reviewedAt: Date.now() } : r))
      );
      toast.success(status === "resolved" ? "تم وضع علامة: تم اتخاذ إجراء" : "تم رفض البلاغ");
    } catch {
      toast.error("تعذّر تحديث البلاغ");
    } finally {
      setActingId(null);
    }
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            البلاغات
            {openCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {openCount} قيد المراجعة
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            بلاغات المستخدمات عن حسابات أخرى — يجب مراجعة كل بلاغ واتخاذ قرار بشأنه.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="text-xs gap-1.5">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:bg-accent/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground">
            لا توجد بلاغات {filter !== "all" ? `بحالة "${STATUS_FILTERS.find((f) => f.id === filter)?.label}"` : ""}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id} className={report.status === "open" ? "border-destructive/30" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      بلاغ ضد: {report.reportedUserName}{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        ({report.reportedUserId})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      من: {report.reporterName} · {formatDate(report.createdAt as any)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {REASON_LABEL[report.reason]}
                    </Badge>
                    <Badge
                      variant={
                        report.status === "open" ? "destructive" : report.status === "resolved" ? "default" : "outline"
                      }
                      className="text-[10px]"
                    >
                      {report.status === "open" ? "قيد المراجعة" : report.status === "resolved" ? "تم اتخاذ إجراء" : "مرفوضة"}
                    </Badge>
                  </div>
                </div>

                {report.note && (
                  <p className="text-xs bg-muted/50 rounded-xl p-3 text-foreground/80">{report.note}</p>
                )}

                {report.status === "open" ? (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="ملاحظة داخلية (اختياري) — سبب القرار، الإجراء المتخذ..."
                      value={noteDrafts[report.id] || ""}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      className="text-xs resize-none"
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(report, "resolved")}
                        disabled={actingId === report.id}
                        className="text-xs gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تم اتخاذ إجراء
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(report, "dismissed")}
                        disabled={actingId === report.id}
                        className="text-xs gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        رفض البلاغ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
                    راجعتها: {report.reviewedBy} · {report.reviewedAt ? formatDate(report.reviewedAt as any) : ""}
                    {report.adminNote ? ` — ${report.adminNote}` : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
