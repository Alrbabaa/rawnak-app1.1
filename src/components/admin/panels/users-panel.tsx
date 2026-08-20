"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, Users as UsersIcon, RefreshCw, X, ShieldCheck, Link2, Headset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AdminUser,
  AdminAccount,
  formatDate,
} from "@/components/admin/admin-types";

interface UsersPanelProps {
  email: string;
  /** Only super_admin can change roles — plain admin sees roles read-only.
   * Mirrors the server-side check in /api/admin/users/[id] (PATCH), which
   * is the real enforcement point; this only controls whether the UI is
   * shown, not actual authorization. */
  viewerRole: "admin" | "super_admin";
}

const ROLE_LABELS: Record<string, string> = {
  user: "مستخدمة",
  admin: "مسؤول",
  super_admin: "مسؤول أعلى",
};

const SKIN_TYPE_LABELS: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

export function UsersPanel({ email, viewerRole }: UsersPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);

  async function changeRole(userId: string, role: string) {
    const previous = users;
    // Optimistic update — reverted below if the request fails.
    setUsers((cur) => cur.map((u) => (u.id === userId ? { ...u, role } : u)));
    setSavingId(userId);
    try {
      const res = await authedFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      toast.success("تم تحديث الدور");
    } catch (err) {
      setUsers(previous);
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSavingId(null);
    }
  }

  async function changeAssignedAdmin(userId: string, assignedAdminId: string | null) {
    const previous = users;
    const admin = admins.find((a) => a.id === assignedAdminId);
    setUsers((cur) =>
      cur.map((u) =>
        u.id === userId
          ? { ...u, assignedAdminId, assignedAdminName: admin?.name || admin?.email || null }
          : u
      )
    );
    setSavingId(userId);
    try {
      const res = await authedFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAdminId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      toast.success(assignedAdminId ? "تم إسناد خدمة العملاء" : "تم إلغاء الإسناد");
    } catch (err) {
      setUsers(previous);
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await authedFetch("/api/admin/users");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "فشل التحميل");
        if (active) setUsers(json.users || []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "خطأ");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [email]);

  useEffect(() => {
    if (viewerRole !== "super_admin") return;
    let active = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/admins");
        const json = await res.json();
        if (res.ok && active) setAdmins(json.admins || []);
      } catch {
        // Non-critical — assignment column just falls back to read-only display.
      }
    })();
    return () => {
      active = false;
    };
  }, [viewerRole]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.name || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text">المستخدمون</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {query.trim()
              ? `عرض ${filtered.length} من أصل ${users.length} مستخدم`
              : `عرض المستخدمين المسجّلين (${users.length})`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="rounded-xl gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </div>

      {viewerRole === "super_admin" && <ReferralReconcileCard />}

      <Card className="glass-card rounded-2xl">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحثي بالبريد أو الاسم في الوقت الفعلي..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-9 pl-9 text-right rounded-xl focus-visible:ring-primary"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <UsersIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {users.length === 0 ? "لا يوجد مستخدمون بعد." : "لا نتائج للبحث."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">خدمة العملاء</TableHead>
                    <TableHead className="text-right hidden md:table-cell">نوع البشرة</TableHead>
                    <TableHead className="text-right">التحليلات</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">الخزانة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">النشاطات</TableHead>
                    <TableHead className="text-right hidden md:table-cell">التسجيل</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">آخر نشاط</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">الإحالات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="border-border/40"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="w-8 h-8 rounded-full rawnak-gradient flex items-center justify-center text-xs font-bold shrink-0">
                            {(u.name || u.email || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" dir="ltr">
                              {u.email}
                            </p>
                            {u.name && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {u.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {viewerRole === "super_admin" ? (
                          <Select
                            value={u.role}
                            disabled={savingId === u.id}
                            onValueChange={(role: string) => changeRole(u.id, role)}
                          >
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">مستخدمة</SelectItem>
                              <SelectItem value="admin">مسؤول</SelectItem>
                              <SelectItem value="super_admin">مسؤول أعلى</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            className={cn(
                              "rounded-md",
                              u.role !== "user"
                                ? "rawnak-rosegold-gradient text-black"
                                : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {viewerRole === "super_admin" ? (
                          <Select
                            value={u.assignedAdminId || "none"}
                            disabled={savingId === u.id}
                            onValueChange={(v) => changeAssignedAdmin(u.id, v === "none" ? null : v)}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue placeholder="غير مُسندة" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">غير مُسندة</SelectItem>
                              {admins.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name || a.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : u.assignedAdminName ? (
                          <Badge variant="outline" className="rounded-md gap-1 text-[11px]">
                            <Headset className="w-3 h-3" />
                            {u.assignedAdminName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {u.skinType ? SKIN_TYPE_LABELS[u.skinType] || u.skinType : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{u.analysesCount}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {u.cabinetCount}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {u.activityCount}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDate(u.lastActive)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.referralInvitesCount > 0 ? (
                          <Badge variant="outline" className="rounded-md text-[11px] gap-1">
                            🔗 {u.referralInvitesCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Manual, on-demand fix for one specific class of drift: a user's
 * `referralInvitesCount` field could, in principle, undercount her real
 * `referralInvites` subcollection size if a very old signup ever hit the
 * bug fixed in /api/auth/complete-signup (retry after the user doc was
 * created but before referral crediting finished, silently skipped ever
 * crediting it). Recomputes the count from the actual subcollection —
 * the source of truth — for every user, and fixes any mismatch. Also
 * backfills the one-time `referralRewardUnlockedAt` badge if the
 * corrected count newly clears the threshold. Deliberately does NOT
 * touch `vipTrialExpiresAt` — how many 7-day blocks were already granted
 * historically isn't reliably reconstructable from a single timestamp,
 * and guessing risks over- or under-granting real VIP time.
 */
function ReferralReconcileCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ checked: number; fixed: number } | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await authedFetch("/api/admin/referral-reconcile", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشلت المطابقة");
      setResult({ checked: json.checked, fixed: json.fixed });
      if (json.fixed > 0) {
        toast.success(`صُحِّح عدد الإحالات لـ ${json.fixed} مستخدمة`);
      } else {
        toast.success("كل أعداد الإحالات صحيحة بالفعل");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="glass-card rounded-2xl border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">مطابقة عدّاد الإحالات</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              تُعيد احتساب عدد إحالات كل مستخدمة من السجلّ الفعلي، وتصحّح أي فارق —
              لضمان عدم ضياع حق أي مُحيلة.
            </p>
            {result && (
              <p className="text-xs mt-1">
                <span className="text-muted-foreground">فُحص {result.checked}</span>
                <span className="font-bold text-primary mr-2">
                  {result.fixed > 0 ? `صُحِّح ${result.fixed}` : "لا فروقات"}
                </span>
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={run}
          disabled={running}
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 shrink-0"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          تشغيل المطابقة
        </Button>
      </CardContent>
    </Card>
  );
}
