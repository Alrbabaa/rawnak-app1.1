"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useState, type ReactNode } from "react";
import { useAdminList } from "@/hooks/use-admin-list";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Handshake,
  RefreshCw,
  Copy,
  Users,
  Wand2,
  MousePointerClick,
  Crown,
  DollarSign,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ReferralPartner,
  formatDate,
} from "@/components/admin/admin-types";

interface ReferralPartnersPanelProps {
  email: string;
}

interface PartnerForm {
  name: string;
  email: string;
  referralCode: string;
  discountPercentage: string;
  commissionPercentage: string;
  status: "active" | "inactive";
  notes: string;
}

const EMPTY_FORM: PartnerForm = {
  name: "",
  email: "",
  referralCode: "",
  discountPercentage: "10",
  commissionPercentage: "10",
  status: "active",
  notes: "",
};

function suggestCode(name: string): string {
  const base =
    (name || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Za-z0-9\u0600-\u06FF]/g, "")
      .slice(0, 6) || "PARTNER";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export function ReferralPartnersPanel({ email }: ReferralPartnersPanelProps) {
  const { data: partners, setData: setPartners, loading, reload: load } = useAdminList<ReferralPartner>(
    "/api/admin/referral-partners",
    email,
    "partners"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailsFor, setDetailsFor] = useState<ReferralPartner | null>(null);

  function openCreate() {
    setForm({ ...EMPTY_FORM, referralCode: suggestCode("") });
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(p: ReferralPartner) {
    setForm({
      name: p.name,
      email: p.email || "",
      referralCode: p.referralCode,
      discountPercentage: String(p.discountPercentage),
      commissionPercentage: String(p.commissionPercentage),
      status: p.status,
      notes: p.notes || "",
    });
    setEditingId(p.id);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("اسم الشريك مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        referralCode: form.referralCode.trim(),
        discountPercentage: Number(form.discountPercentage) || 0,
        commissionPercentage: Number(form.commissionPercentage) || 0,
        status: form.status,
        notes: form.notes.trim(),
      };
      const isEdit = !!editingId;
      const res = await authedFetch(
        "/api/admin/referral-partners" + (isEdit ? `/${editingId}` : ""),
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? { id: editingId, ...payload } : payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحفظ");
      toast.success(isEdit ? "تم تحديث الشريك ✦" : "تم إنشاء الشريك ✦");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(p: ReferralPartner) {
    const nextStatus = p.status === "active" ? "inactive" : "active";
    try {
      const res = await authedFetch(`/api/admin/referral-partners/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      setPartners((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, status: nextStatus } : x))
      );
      toast.success(nextStatus === "active" ? "تم تفعيل الشريك" : "تم تعطيل الشريك");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await authedFetch(`/api/admin/referral-partners/${deleteId}?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحذف");
      toast.success("تم حذف الشريك");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setDeleting(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => toast.success("تم نسخ رمز الإحالة"),
      () => toast.error("تعذّر النسخ")
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text">الشركاء والإحالات</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة شركاء الإحالة، أكوادهم، ونِسب الخصم والعمولة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="rounded-xl gap-1.5">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
          <Button
            onClick={openCreate}
            className="rawnak-rosegold-gradient text-black font-semibold rounded-xl gap-1.5"
          >
            <Plus className="w-4 h-4" />
            شريك جديد
          </Button>
        </div>
      </div>

      {/* Honesty banner — matches the product's "no fake numbers" principle */}
      <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 text-sm text-muted-foreground leading-relaxed">
          ⚠️ التسجيلات أرقام حقيقية من قاعدة البيانات. أما النقرات والاشتراكات المدفوعة والإيراد
          والعمولة التقديرية فهي عناصر <b>Placeholder</b> فقط حالياً — لا يوجد نظام تتبّع نقرات
          ولا مزوّد دفع مربوط بعد. ستُحسب تلقائياً بمجرد ربط Stripe أو RevenueCat أو Google Play
          Billing دون أي تغيير ببنية هذي الشاشة.
        </CardContent>
      </Card>

      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : partners.length === 0 ? (
            <div className="py-16 text-center">
              <Handshake className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا يوجد شركاء بعد. أضيفي أول شريك.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right">الشريك</TableHead>
                    <TableHead className="text-right">رمز الإحالة</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">خصم %</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">عمولة %</TableHead>
                    <TableHead className="text-right">تسجيلات</TableHead>
                    <TableHead className="text-right">مفعّل</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.id} className="border-border/40">
                      <TableCell>
                        <div className="min-w-[140px]">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          {p.email && (
                            <p className="text-[11px] text-muted-foreground truncate" dir="ltr">
                              {p.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyCode(p.referralCode)}
                          className="flex items-center gap-1.5 group"
                          aria-label="نسخ رمز الإحالة"
                        >
                          <Badge variant="secondary" className="rounded-md font-mono" dir="ltr">
                            {p.referralCode}
                          </Badge>
                          <Copy className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                        </button>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {p.discountPercentage}%
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {p.commissionPercentage}%
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setDetailsFor(p)}
                          className="flex items-center gap-1 text-sm font-semibold hover:underline"
                        >
                          <Users className="w-3.5 h-3.5 text-primary" />
                          {p.stats.totalRegistrations}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={p.status === "active"}
                          onCheckedChange={() => toggleStatus(p)}
                          aria-label="تفعيل الشريك"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailsFor(p)}
                            className="h-8 w-8 p-0"
                            aria-label="عرض التفاصيل"
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(p)}
                            className="h-8 w-8 p-0"
                            aria-label="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(p.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل الشريك" : "شريك جديد"}</DialogTitle>
            <DialogDescription>
              نسبة الخصم والعمولة تُحفظ الآن كبيانات فقط — لا يُطبَّق أي خصم أو دفع فعلي بعد.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rp-name">اسم الشريك</Label>
              <Input
                id="rp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: سلمى للمكياج"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rp-email">البريد الإلكتروني (اختياري)</Label>
              <Input
                id="rp-email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="partner@example.com"
                dir="ltr"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rp-code">رمز الإحالة</Label>
              <div className="flex gap-2">
                <Input
                  id="rp-code"
                  value={form.referralCode}
                  onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
                  placeholder="SALMA-2X9K"
                  dir="ltr"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl gap-1.5 shrink-0"
                  onClick={() => setForm({ ...form, referralCode: suggestCode(form.name) })}
                >
                  <Wand2 className="w-4 h-4" />
                  توليد
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-discount">نسبة الخصم للمستخدمة %</Label>
              <Input
                id="rp-discount"
                type="number"
                min={0}
                max={100}
                value={form.discountPercentage}
                onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-commission">نسبة عمولة الشريك %</Label>
              <Input
                id="rp-commission"
                type="number"
                min={0}
                max={100}
                value={form.commissionPercentage}
                onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="flex items-center justify-between gap-2 sm:col-span-2 pt-1">
              <Label htmlFor="rp-status" className="text-sm">
                الشريك مفعّل (يقبل رمزه بالتسجيل)
              </Label>
              <Switch
                id="rp-status"
                checked={form.status === "active"}
                onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rp-notes">ملاحظات</Label>
              <Textarea
                id="rp-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="اتفاقية خاصة، شروط، ملاحظات داخلية..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="rawnak-rosegold-gradient text-black font-semibold rounded-xl gap-1.5"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
              {editingId ? "حفظ التغييرات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partner details: real registrations list + honest placeholder stats */}
      <Dialog open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailsFor?.name}</DialogTitle>
            <DialogDescription dir="ltr" className="font-mono text-xs">
              {detailsFor?.referralCode}
            </DialogDescription>
          </DialogHeader>

          {detailsFor && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatBox
                  icon={<Users className="w-4 h-4" />}
                  label="تسجيلات"
                  value={String(detailsFor.stats.totalRegistrations)}
                  real
                />
                <StatBox
                  icon={<MousePointerClick className="w-4 h-4" />}
                  label="نقرات"
                  value="—"
                />
                <StatBox
                  icon={<Crown className="w-4 h-4" />}
                  label="اشتراكات مدفوعة"
                  value="—"
                />
                <StatBox
                  icon={<DollarSign className="w-4 h-4" />}
                  label="إيراد تقديري"
                  value="—"
                />
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2 flex items-center gap-1">
                <Percent className="w-3 h-3" />
                الأرقام بعلامة "—" عناصر Placeholder بانتظار ربط مزوّد دفع حقيقي.
              </p>

              <div>
                <h4 className="text-sm font-bold mb-2">المستخدمات المُحالات</h4>
                {detailsFor.referredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    لا يوجد تسجيلات بعد بهذا الرمز.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto pretty-scroll rounded-xl border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الاسم</TableHead>
                          <TableHead className="text-right">البريد</TableHead>
                          <TableHead className="text-right">تاريخ التسجيل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailsFor.referredUsers.map((u) => (
                          <TableRow key={u.referralId}>
                            <TableCell className="text-sm">{u.name || "—"}</TableCell>
                            <TableCell className="text-sm" dir="ltr">
                              {u.email}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(u.registeredAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsFor(null)} className="rounded-xl">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنتِ متأكدة من حذف هذا الشريك؟ سيُحذف معه سجلّ إحالاته. لا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-1.5"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  real,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  real?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 p-3 text-center">
      <div className={`flex items-center justify-center gap-1 mb-1 ${real ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
