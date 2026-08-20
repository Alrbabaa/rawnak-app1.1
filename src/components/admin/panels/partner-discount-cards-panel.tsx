"use client";

import { useState, useEffect } from "react";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Gift,
  Pin,
  ExternalLink,
  Copy,
  MousePointerClick,
  Building2,
  Globe,
  Tag,
  Check,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { PartnerDiscountCard, SEED_PARTNER_CARDS } from "@/lib/partner-cards-data";

interface PartnerDiscountCardsPanelProps {
  email: string;
}

interface PartnerCardForm {
  partnerName: string;
  branchName: string;
  brandLogoUrl: string;
  bannerImageUrl: string;
  discountCode: string;
  discountLabel: string;
  description: string;
  storeUrl: string;
  category: string;
  country: string;
  pinned: boolean;
  isFeatured: boolean;
  displayDurationSeconds: number;
  status: "active" | "inactive" | "expired";
}

const EMPTY_FORM: PartnerCardForm = {
  partnerName: "",
  branchName: "الفرع الرئيسي",
  brandLogoUrl: "",
  bannerImageUrl: "",
  discountCode: "",
  discountLabel: "خصم 15% حصري",
  description: "",
  storeUrl: "https://",
  category: "متاجر إلكترونية",
  country: "الجميع",
  pinned: false,
  isFeatured: false,
  displayDurationSeconds: 10,
  status: "active",
};

export function PartnerDiscountCardsPanel({ email }: PartnerDiscountCardsPanelProps) {
  const [cards, setCards] = useState<PartnerDiscountCard[]>(SEED_PARTNER_CARDS);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerCardForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    try {
      const res = await authedFetch("/api/admin/partner-cards");
      if (res.ok) {
        const data = await res.json();
        if (data.cards) setCards(data.cards);
      }
    } catch {
      // fallback to seed
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    authedFetch("/api/admin/partner-cards")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.cards) setCards(data.cards);
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [email]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (card: PartnerDiscountCard) => {
    setEditingId(card.id);
    setForm({
      partnerName: card.partnerName,
      branchName: card.branchName || "",
      brandLogoUrl: card.brandLogoUrl || "",
      bannerImageUrl: card.bannerImageUrl || "",
      discountCode: card.discountCode,
      discountLabel: card.discountLabel,
      description: card.description || "",
      storeUrl: card.storeUrl,
      category: card.category,
      country: card.country,
      pinned: card.pinned,
      isFeatured: Boolean(card.isFeatured),
      displayDurationSeconds: card.displayDurationSeconds || 10,
      status: card.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partnerName.trim() || !form.discountCode.trim()) {
      toast.error("اسم الشريك وكود الخصم مطلوبان");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const res = await authedFetch(`/api/admin/partner-cards/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        if (res.ok) {
          toast.success("تم تحديث بطاقة الخصم بنجاح ✦");
          setDialogOpen(false);
          load();
        } else {
          toast.error("فشل التحديث");
        }
      } else {
        const res = await authedFetch("/api/admin/partner-cards", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (res.ok) {
          toast.success("تم إضافة بطاقة الخصم الجديدة بنجاح ✦");
          setDialogOpen(false);
          load();
        } else {
          toast.error("فشل الحفظ");
        }
      }
    } catch {
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (card: PartnerDiscountCard) => {
    try {
      const res = await authedFetch(`/api/admin/partner-cards/${card.id}`, {
        method: "PUT",
        body: JSON.stringify({ pinned: !card.pinned }),
      });
      if (res.ok) {
        toast.success(card.pinned ? "تم إلغاء تثبيت البطاقة" : "تم تثبيت البطاقة في المقدمة 📌");
        load();
      }
    } catch {
      toast.error("حدث خطأ أثناء التحديث");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await authedFetch(`/api/admin/partner-cards/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("تم حذف بطاقة الخصم بنجاح");
        setDeleteId(null);
        load();
      }
    } catch {
      toast.error("حدث خطأ عند الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = cards.filter(
    (c) =>
      c.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.discountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.branchName && c.branchName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4 dir-rtl" dir="rtl">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 grid place-items-center">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base text-foreground">
              بطاقات خصم وتخفيض الشركاء
            </h2>
            <p className="text-xs text-muted-foreground">
              إدارة بطاقات الكوبونات الإعلانية والفروع وحساب تفاعلات المستخدمات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={openCreate}
            size="sm"
            className="rounded-xl h-9 px-3.5 text-xs font-bold gap-1.5 bg-amber-500 text-white hover:bg-amber-600 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة بطاقة خصم شركاء</span>
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث باسم الشريك، الفرع، أو كود الخصم..."
          className="pr-9 rounded-xl text-xs bg-card border-border"
        />
      </div>

      {/* Table Card */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <Table dir="rtl">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-right font-bold text-xs">الشريك والفرع</TableHead>
                <TableHead className="text-right font-bold text-xs">كود الخصم والعنوان</TableHead>
                <TableHead className="text-right font-bold text-xs">الدولة والتصنيف</TableHead>
                <TableHead className="text-center font-bold text-xs">تفاعل المستخدمين</TableHead>
                <TableHead className="text-center font-bold text-xs">التثبيت / الحالة</TableHead>
                <TableHead className="text-left font-bold text-xs pl-4">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    لا توجد بطاقات خصم مسجلة
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((card) => (
                  <TableRow key={card.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-extrabold text-xs">
                      <div className="flex items-center gap-2.5">
                        {card.brandLogoUrl ? (
                          <img
                            src={card.brandLogoUrl}
                            alt={card.partnerName}
                            className="w-9 h-9 rounded-xl object-cover border shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 font-bold grid place-items-center shrink-0 text-xs">
                            {card.partnerName.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <span className="font-extrabold text-foreground block flex items-center gap-1">
                            {card.partnerName}
                            {card.pinned && (
                              <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </span>
                          {card.branchName && (
                            <span className="text-[10px] text-muted-foreground font-medium block">
                              {card.branchName}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="text-xs font-mono font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md inline-block">
                          {card.discountCode}
                        </span>
                        <span className="text-[11px] text-foreground font-bold block">
                          {card.discountLabel}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <Badge variant="outline" className="w-fit text-[10px] py-0">
                          {card.country}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">{card.category}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-muted-foreground" title="عدد النسخ">
                          <Copy className="w-3 h-3 text-primary" />
                          <strong className="text-foreground">{card.copyCount || 0}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground" title="عدد النقرات">
                          <MousePointerClick className="w-3 h-3 text-amber-500" />
                          <strong className="text-foreground">{card.clickCount || 0}</strong>
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePin(card)}
                          className={cn(
                            "p-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1",
                            card.pinned
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-600"
                              : "bg-muted border-border text-muted-foreground"
                          )}
                          title="تثبيت البطاقة في مقدمة القائمة"
                        >
                          <Pin className="w-3 h-3" />
                          <span>{card.pinned ? "مثبتة" : "تثبيت"}</span>
                        </button>

                        <Badge
                          className={cn(
                            "text-[10px] py-0.5",
                            card.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          )}
                        >
                          {card.status === "active" ? "مفعّلة" : "متوقفة"}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell className="text-left pl-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          onClick={() => openEdit(card)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          onClick={() => setDeleteId(card.id)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-5 border-border bg-card dir-rtl shadow-2xl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              {editingId ? "تعديل بطاقة خصم الشريك" : "إضافة بطاقة خصم جديدة للشركاء"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              حدد الشريك، الفرع، كود الخصم والصور الإعلانية
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">اسم الشريك التجاري *</Label>
                <Input
                  value={form.partnerName}
                  onChange={(e) => setForm({ ...form, partnerName: e.target.value })}
                  placeholder="مثال: سيفورا، نايس ون..."
                  className="rounded-xl text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">اسم الفرع / التابعية</Label>
                <Input
                  value={form.branchName}
                  onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                  placeholder="مثال: فرع عمان - الأردن"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">كود الخصم *</Label>
                <Input
                  value={form.discountCode}
                  onChange={(e) => setForm({ ...form, discountCode: e.target.value })}
                  placeholder="RAWNAK15"
                  className="rounded-xl text-xs h-9 font-mono font-bold uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">عنوان الخصم المباشر</Label>
                <Input
                  value={form.discountLabel}
                  onChange={(e) => setForm({ ...form, discountLabel: e.target.value })}
                  placeholder="مثال: خصم 15% حصري"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">رابط شعار الماركة (Logo URL)</Label>
                <Input
                  value={form.brandLogoUrl}
                  onChange={(e) => setForm({ ...form, brandLogoUrl: e.target.value })}
                  placeholder="https://example.com/logo.jpg"
                  className="rounded-xl text-xs h-9 dir-ltr text-left"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">رابط صورة البانر الإعلاني (Banner)</Label>
                <Input
                  value={form.bannerImageUrl}
                  onChange={(e) => setForm({ ...form, bannerImageUrl: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  className="rounded-xl text-xs h-9 dir-ltr text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">الدولة المستهدفة</Label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-xl text-xs h-9 bg-card border border-border px-3 text-foreground"
                >
                  <option value="الجميع">الجميع (كافة الدول)</option>
                  <option value="المغرب">المغرب 🇲🇦</option>
                  <option value="الجزائر">الجزائر 🇩🇿</option>
                  <option value="تونس">تونس 🇹🇳</option>
                  <option value="ليبيا">ليبيا 🇱🇾</option>
                  <option value="السودان">السودان 🇸🇩</option>
                  <option value="مصر">مصر 🇪🇬</option>
                  <option value="السعودية">السعودية 🇸🇦</option>
                  <option value="الإمارات">الإمارات 🇦🇪</option>
                  <option value="الأردن">الأردن 🇯🇴</option>
                  <option value="الكويت">الكويت 🇰🇼</option>
                  <option value="قطر">قطر 🇶🇦</option>
                  <option value="البحرين">البحرين 🇧🇭</option>
                  <option value="عُمان">عُمان 🇴🇲</option>
                  <option value="العراق">العراق 🇮🇶</option>
                  <option value="لبنان">لبنان 🇱🇧</option>
                  <option value="فلسطين">فلسطين 🇵🇸</option>
                  <option value="موريتانيا">موريتانيا 🇲🇷</option>
                  <option value="سوريا">سوريا 🇸🇾</option>
                  <option value="تركيا">تركيا 🇹🇷</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">التصنيف</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl text-xs h-9 bg-card border border-border px-3 text-foreground"
                >
                  <option value="متاجر إلكترونية">متاجر إلكترونية</option>
                  <option value="صيدليات">صيدليات</option>
                  <option value="براندات مباشرة">براندات مباشرة</option>
                  <option value="عيادات تجميل">عيادات تجميل</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">رابط المتجر / الإحالة (Store URL)</Label>
              <Input
                value={form.storeUrl}
                onChange={(e) => setForm({ ...form, storeUrl: e.target.value })}
                placeholder="https://store.com?ref=rawnak"
                className="rounded-xl text-xs h-9 dir-ltr text-left"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">تفاصيل العرض / وصف إضافي</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="تفاصيل التخفيض والشروط الشائعة..."
                className="rounded-xl text-xs min-h-[60px]"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/60">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">تثبيت البطاقة في أعلى القائمة</span>
                <span className="text-[10px] text-muted-foreground block">ستظهر هذه البطاقة أولاً للمستخدمين</span>
              </div>
              <Switch
                checked={form.pinned}
                onCheckedChange={(c) => setForm({ ...form, pinned: c })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-amber-600 block">⭐ بطاقة شريك مميز (Featured VIP Slot)</span>
                <span className="text-[10px] text-muted-foreground block">تظهر في مكان مخصص ومميز للمستخدمين دون التأثير على التجربة</span>
              </div>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(c) => setForm({ ...form, isFeatured: c })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">مدة عرض البطاقة في التبديل التلقائي (بالثواني)</Label>
              <Input
                type="number"
                min={3}
                max={120}
                value={form.displayDurationSeconds}
                onChange={(e) => setForm({ ...form, displayDurationSeconds: parseInt(e.target.value) || 10 })}
                className="rounded-xl text-xs h-9"
              />
              <p className="text-[10px] text-muted-foreground">الوقت الذي تظل فيه البطاقة معروضة قبل التبديل التلقائي للبطاقة التالية في البانر المتحرك (مثال: 10 أو 15 ثانية).</p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl h-9 text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl h-9 text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{editingId ? "حفظ التعديلات" : "إضافة البطاقة ✦"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-5 border-border bg-card dir-rtl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-extrabold text-rose-500">
              تأكيد حذف بطاقة الخصم
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              هل أنتِ متأكدة من حذف هذه البطاقة؟ لن تتمكن المستخدمات من رؤيتها.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="rounded-xl h-9 text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl h-9 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>تأكيد الحذف</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
