"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { useAdminList } from "@/hooks/use-admin-list";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  PRODUCT_DEPARTMENTS,
  CATALOG_COUNTRIES,
  GLOBAL_COUNTRY,
  categoriesForDepartment,
  type ProductDepartment,
} from "@/lib/data";
import {
  Pick,
  parseList,
} from "@/components/admin/admin-types";
import { ImagePlus, Loader2 as SpinnerIcon, X, Globe2 } from "lucide-react";

interface PicksPanelProps {
  email: string;
}

interface PickForm {
  name: string;
  brand: string;
  department: ProductDepartment;
  category: string;
  description: string;
  price: string;
  store: string;
  purchaseUrl: string;
  emoji: string;
  photoUrl: string;
  countries: string[]; // ISO2 codes, or [GLOBAL_COUNTRY]
  rating: number;
  reasons: string; // comma-separated
  bestFor: string; // comma-separated
  published: boolean;
  trending: boolean;
}

const EMPTY_FORM: PickForm = {
  name: "",
  brand: "",
  department: "beauty",
  category: "serum",
  description: "",
  price: "",
  store: "",
  purchaseUrl: "",
  emoji: "✨",
  photoUrl: "",
  countries: [GLOBAL_COUNTRY],
  rating: 5,
  reasons: "",
  bestFor: "",
  published: true,
  trending: false,
};

function catLabel(department: string, id: string): string {
  return categoriesForDepartment(department).find((c) => c.id === id)?.label || id;
}

function catEmoji(department: string, id: string): string {
  return categoriesForDepartment(department).find((c) => c.id === id)?.emoji || "💄";
}

function departmentLabel(id: string): string {
  return PRODUCT_DEPARTMENTS.find((d) => d.id === id)?.label || id;
}

/** Resize an uploaded image client-side before turning it into a data URL. */
function fileToResizedDataUrl(file: File, max = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const ratio = Math.min(max / width, max / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas error"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("تعذّرت قراءة الصورة"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("تعذّرت قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export function PicksPanel({ email }: PicksPanelProps) {
  const { data: picks, setData: setPicks, loading, reload: load } = useAdminList<Pick>(
    "/api/admin/picks",
    email,
    "picks"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PickForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Bulk import — plain text paste, one product per line, NO AI call
  // (see /api/admin/picks POST — a straight Firestore write). Keeps the
  // "add lots of products quickly" need met without adding anything to
  // the app's AI cost surface.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDepartment, setBulkDepartment] = useState<ProductDepartment>("fashion");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: number } | null>(null);

  // Table filters — also gate the drag-reorder view: dragging only makes
  // sense once scoped to one (department, category), otherwise "order"
  // has no shared meaning across a mixed list.
  const [filterDept, setFilterDept] = useState<ProductDepartment | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const scopedToOneCategory = filterDept !== "all" && filterCategory !== "all";

  const visiblePicks = picks
    .filter((p) => filterDept === "all" || (p.department || "beauty") === filterDept)
    .filter((p) => filterCategory === "all" || p.category === filterCategory)
    .sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : Infinity;
      const bo = typeof b.order === "number" ? b.order : Infinity;
      return ao - bo;
    });

  const [reordering, setReordering] = useState(false);

  async function persistOrder(list: Pick[]) {
    setPicks((prev) => {
      const positions = new Map(list.map((p, i) => [p.id, i]));
      return prev.map((p) => (positions.has(p.id) ? { ...p, order: positions.get(p.id) } : p));
    });
    setReordering(true);
    try {
      await Promise.all(
        list.map((p, i) =>
          authedFetch(`/api/admin/picks/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: p.id, order: i }),
          })
        )
      );
    } catch {
      toast.error("تعذّر حفظ الترتيب بالكامل");
    } finally {
      setReordering(false);
    }
  }

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const res = await authedFetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, folder: "products" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل رفع الصورة");
      setForm((prev) => ({ ...prev, photoUrl: json.url }));
      toast.success("تم رفع صورة المنتج ✦");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ أثناء رفع الصورة");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleCountry = (code: string) => {
    setForm((prev) => {
      if (code === GLOBAL_COUNTRY) {
        return { ...prev, countries: [GLOBAL_COUNTRY] };
      }
      const withoutGlobal = prev.countries.filter((c) => c !== GLOBAL_COUNTRY);
      const has = withoutGlobal.includes(code);
      const next = has ? withoutGlobal.filter((c) => c !== code) : [...withoutGlobal, code];
      return { ...prev, countries: next.length > 0 ? next : [GLOBAL_COUNTRY] };
    });
  };

  const handleAutoFetchUrl = async () => {
    if (!form.purchaseUrl || !/^https?:\/\//.test(form.purchaseUrl.trim())) {
      toast.error("يرجى إدخال رابط شراء صحيح يبدأ بـ http أو https");
      return;
    }
    setFetchingUrl(true);
    try {
      const res = await fetch("/api/import-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.purchaseUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر جلب البيانات من الرابط");
      setForm((prev) => ({
        ...prev,
        name: prev.name || data.name || "",
        brand: prev.brand || data.brand || "",
        description: prev.description || data.description || "",
        price: data.price || prev.price || "",
        store: data.store || prev.store || "",
      }));
      toast.success("تم استخراج بيانات المنتج والسعر! يمكنك تعديل السعر بحرية ✦");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ أثناء جلب الرابط");
    } finally {
      setFetchingUrl(false);
    }
  };

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(p: Pick) {
    setForm({
      name: p.name,
      brand: p.brand,
      department: (p.department as ProductDepartment) || "beauty",
      category: p.category,
      description: p.description || "",
      price: p.price,
      store: p.store,
      purchaseUrl: p.purchaseUrl,
      emoji: p.emoji,
      photoUrl: p.photoUrl || "",
      countries: p.countries && p.countries.length > 0 ? p.countries : [GLOBAL_COUNTRY],
      rating: p.rating,
      reasons: (p.reasons || []).join("، "),
      bestFor: (p.bestFor || []).join("، "),
      published: p.published,
      trending: !!p.trending,
    });
    setEditingId(p.id);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("اسم المنتج مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        department: form.department,
        category: form.category,
        description: form.description.trim(),
        price: form.price.trim(),
        store: form.store.trim(),
        purchaseUrl: form.purchaseUrl.trim(),
        emoji: form.emoji.trim() || "✨",
        photoUrl: form.photoUrl || null,
        countries: form.countries.length > 0 ? form.countries : [GLOBAL_COUNTRY],
        rating: Number(form.rating) || 5,
        reasons: parseList(form.reasons),
        bestFor: parseList(form.bestFor),
        published: form.published,
        trending: form.trending,
      };
      const isEdit = !!editingId;
      const res = await authedFetch("/api/admin/picks" + (isEdit ? `/${editingId}` : ""), {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحفظ");
      toast.success(isEdit ? "تم تحديث المنتج ✦" : "تم إنشاء المنتج ✦");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function submitBulkImport() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error("أضيفي سطرًا واحدًا على الأقل");
      return;
    }
    if (!bulkCategory) {
      toast.error("اختاري الفئة الفرعية لهذه الدفعة");
      return;
    }
    if (lines.length > 100) {
      toast.error("الحد الأقصى 100 سطر في الدفعة الواحدة");
      return;
    }
    setBulkSubmitting(true);
    setBulkResult(null);
    let created = 0;
    let failed = 0;
    // Sequential on purpose — simple, easy to reason about progress-wise,
    // and each call is a cheap plain Firestore write (no AI), so there's
    // no real cost pressure to parallelize.
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      const [name, brand, price, purchaseUrl] = parts;
      if (!name) {
        failed++;
        continue;
      }
      try {
        const res = await authedFetch("/api/admin/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            brand: brand || "",
            department: bulkDepartment,
            category: bulkCategory,
            price: price || "",
            purchaseUrl: purchaseUrl || "",
            emoji: categoriesForDepartment(bulkDepartment).find((c) => c.id === bulkCategory)?.emoji || "✨",
            countries: [GLOBAL_COUNTRY],
            rating: 5,
            // Drafts by default — admin reviews/completes each one
            // (description, photo, exact country availability…) before
            // publishing, same as any other product.
            published: false,
          }),
        });
        if (res.ok) created++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkSubmitting(false);
    setBulkResult({ created, failed });
    if (created > 0) {
      toast.success(`أُضيف ${created} منتجًا كمسودات — راجعيها وانشريها`);
      load();
    }
    if (failed > 0 && created === 0) {
      toast.error("تعذّر إضافة أي منتج، تحققي من التنسيق");
    }
  }

  async function togglePublished(p: Pick) {
    try {
      const res = await authedFetch(`/api/admin/picks/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, published: !p.published }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      setPicks((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, published: !p.published } : x))
      );
      toast.success(p.published ? "أُخفي المنتج" : "نُشر المنتج");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  }

  async function toggleTrending(p: Pick) {
    try {
      const res = await authedFetch(`/api/admin/picks/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, trending: !p.trending }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      setPicks((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, trending: !p.trending } : x))
      );
      toast.success(p.trending ? "أُزيل من الترندات" : "أُضيف إلى الترندات 🔥");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await authedFetch(`/api/admin/picks/${deleteId}?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحذف");
      toast.success("تم حذف المنتج");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text">اختيارات رَونق</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة المنتجات المختارة مع روابط الشراء
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="rounded-xl gap-1.5">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setBulkText("");
              setBulkCategory("");
              setBulkResult(null);
              setBulkOpen(true);
            }}
            className="rounded-xl gap-1.5"
          >
            <Link2 className="w-4 h-4" />
            استيراد جماعي
          </Button>
          <Button
            onClick={openCreate}
            className="rawnak-rosegold-gradient text-black font-semibold rounded-xl gap-1.5"
          >
            <Plus className="w-4 h-4" />
            إضافة منتج
          </Button>
        </div>
      </div>

      {/* Filters — also scope the drag-reorder view below to one (department, category) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filterDept}
          onValueChange={(v) => {
            setFilterDept(v as ProductDepartment | "all");
            setFilterCategory("all");
          }}
        >
          <SelectTrigger className="rounded-xl w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأقسام</SelectItem>
            {PRODUCT_DEPARTMENTS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.emoji} {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterCategory}
          onValueChange={setFilterCategory}
          disabled={filterDept === "all"}
        >
          <SelectTrigger className="rounded-xl w-44">
            <SelectValue placeholder="كل الفئات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {filterDept !== "all" &&
              categoriesForDepartment(filterDept).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {scopedToOneCategory && (
          <Badge variant="outline" className="rounded-full text-[11px] gap-1">
            {reordering ? <SpinnerIcon className="w-3 h-3 animate-spin" /> : "↕"} اسحبي البطاقات لترتيب ظهورها للمستخدمات
          </Badge>
        )}
      </div>

      {scopedToOneCategory ? (
        <Card className="glass-card rounded-2xl overflow-hidden p-3">
          {visiblePicks.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-muted-foreground text-sm">لا توجد منتجات في هذه الفئة بعد</p>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={visiblePicks}
              onReorder={persistOrder}
              className="space-y-2"
            >
              {visiblePicks.map((p) => (
                <Reorder.Item
                  key={p.id}
                  value={p}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card cursor-grab active:cursor-grabbing"
                >
                  <span className="text-muted-foreground text-lg select-none">⠿</span>
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted grid place-items-center text-lg">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      p.emoji
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.brand}</p>
                  </div>
                  {!p.published && (
                    <Badge variant="outline" className="text-[10px] rounded-md shrink-0">
                      مسودة
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(p)}
                    className="rounded-lg shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </Card>
      ) : (
      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : visiblePicks.length === 0 ? (
            <div className="py-16 text-center">
              <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا توجد منتجات بعد. أضيفي أول منتج.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right hidden md:table-cell">القسم / الفئة</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">السعر</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">المتجر</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">الدول</TableHead>
                    <TableHead className="text-right">التقييم</TableHead>
                    <TableHead className="text-right">منشور</TableHead>
                    <TableHead className="text-right">ترند 🔥</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePicks.map((p) => (
                    <TableRow key={p.id} className="border-border/40">
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="w-9 h-9 rounded-lg rawnak-gradient flex items-center justify-center text-base shrink-0 overflow-hidden">
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.emoji || catEmoji(p.department, p.category)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {p.brand}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {departmentLabel(p.department || "beauty")}
                          </Badge>
                          <Badge variant="secondary" className="rounded-md">
                            {catEmoji(p.department, p.category)} {catLabel(p.department, p.category)}
                          </Badge>
                          {p.trending && (
                            <Badge className="rounded-md text-[10px] bg-orange-500/15 text-orange-600 border-orange-500/30">
                              🔥 ترند
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="rawnak-gold-text font-medium text-sm">
                          {p.price || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {p.store || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {!p.countries || p.countries.includes(GLOBAL_COUNTRY) ? (
                          <Badge variant="outline" className="rounded-md text-[10px] gap-1">
                            <Globe2 className="w-3 h-3" /> عالمي
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[140px]">
                            {p.countries.map((c) => (
                              <span key={c} className="text-sm" title={c}>
                                {CATALOG_COUNTRIES.find((cc) => cc.code === c)?.flag || c}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-3.5 h-3.5",
                                i < p.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                        {(p.engagementCount || 0) > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            🔥 طلب: {p.engagementCount}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={p.published}
                          onCheckedChange={() => togglePublished(p)}
                          aria-label="نشر"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!p.trending}
                          onCheckedChange={() => toggleTrending(p)}
                          aria-label="ترند"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(p)}
                            className="h-8 w-8 p-0"
                            aria-label="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {p.purchaseUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              asChild
                            >
                              <a
                                href={p.purchaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="رابط الشراء"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
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
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pretty-scroll">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
            <DialogDescription>
              أدخلي تفاصيل المنتج والروابط. سيظهر للمستخدمات في قسم اختيارات رَونق.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-name">اسم المنتج *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="سيروم فيتامين C 23%"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-brand">العلامة التجارية</Label>
              <Input
                id="p-brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="The Ordinary"
              />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select
                value={form.department}
                onValueChange={(v) => {
                  const dep = v as ProductDepartment;
                  const firstCat = categoriesForDepartment(dep)[0]?.id || "";
                  setForm({ ...form, department: dep, category: firstCat });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_DEPARTMENTS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.emoji} {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفئة الفرعية</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriesForDepartment(form.department).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Country availability */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>الدول المتوفر فيها المنتج</Label>
                <button
                  type="button"
                  onClick={() => toggleCountry(GLOBAL_COUNTRY)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1 transition-colors",
                    form.countries.includes(GLOBAL_COUNTRY)
                      ? "bg-primary/15 border-primary/50 text-primary"
                      : "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  متوفر عالميًا (كل الدول)
                </button>
              </div>
              {!form.countries.includes(GLOBAL_COUNTRY) && (
                <p className="text-[11px] text-muted-foreground pb-1">
                  اختاري الدول التي يتوفر بها هذا المتجر أو المنتج — سيظهر فقط لمستخدمات هذه الدول.
                  اختاري أكثر من دولة إن كان المتجر متوفرًا في أكثر من مكان (مثال: الأردن والإمارات).
                </p>
              )}
              <div
                className={cn(
                  "flex flex-wrap gap-1.5",
                  form.countries.includes(GLOBAL_COUNTRY) && "opacity-40 pointer-events-none"
                )}
              >
                {CATALOG_COUNTRIES.map((c) => {
                  const active = form.countries.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleCountry(c.code)}
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1 transition-colors",
                        active
                          ? "bg-primary/15 border-primary/50 text-primary"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      <span>{c.flag}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product photo */}
            <div className="space-y-2 sm:col-span-2">
              <Label>صورة المنتج (اختياري — بديل عن الرمز التعبيري)</Label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-muted grid place-items-center overflow-hidden shrink-0 border border-border">
                  {uploadingPhoto ? (
                    <SpinnerIcon className="w-5 h-5 animate-spin text-primary" />
                  ) : form.photoUrl ? (
                    <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{form.emoji || "🖼️"}</span>
                  )}
                </div>
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelected}
                    disabled={uploadingPhoto}
                  />
                  <span
                    className={cn(
                      "flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-dashed cursor-pointer transition-colors",
                      "border-primary/40 text-primary hover:bg-primary/10"
                    )}
                  >
                    <ImagePlus className="w-4 h-4" />
                    {form.photoUrl ? "استبدال الصورة" : "رفع صورة من الجهاز"}
                  </span>
                </label>
                {form.photoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => setForm({ ...form, photoUrl: "" })}
                    aria-label="إزالة الصورة"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-url">رابط الشراء المستورد (أدخلي رابط المنتج من المتجر)</Label>
              <div className="flex gap-2">
                <Input
                  id="p-url"
                  value={form.purchaseUrl}
                  onChange={(e) => setForm({ ...form, purchaseUrl: e.target.value })}
                  placeholder="https://www.sephora.com/product/..."
                  dir="ltr"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAutoFetchUrl}
                  disabled={fetchingUrl}
                  variant="outline"
                  className="shrink-0 border-primary/40 hover:bg-primary/10 text-xs font-bold gap-1.5"
                >
                  {fetchingUrl ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 text-primary" />
                  )}
                  جلب بالرابط
                </Button>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="p-price" className="font-extrabold text-xs">
                  السعر الحر للمنتج (غير محدد - اكتب أي رقم أو عملة)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  إدخال يدوي أو من الاستيراد
                </span>
              </div>
              <Input
                id="p-price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="أدخلي السعر بحرية (مثال: 85 ر.س، 25$، 110 د.إ، أو مجاناً)"
                className="font-bold text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-muted-foreground ml-1">إضافة عملة سريعة:</span>
                {["ر.س", "د.إ", "$", "د.ك", "ر.ع", "EGP", "مجاناً"].map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => {
                      if (!form.price) {
                        setForm({ ...form, price: curr === "مجاناً" ? "مجاناً" : `0 ${curr}` });
                      } else if (!form.price.includes(curr)) {
                        setForm({ ...form, price: `${form.price.trim()} ${curr}` });
                      }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 hover:text-primary transition-colors font-semibold border border-border"
                  >
                    +{curr}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-store">المتجر</Label>
              <Input
                id="p-store"
                value={form.store}
                onChange={(e) => setForm({ ...form, store: e.target.value })}
                placeholder="Sephora / Amazon / Noon..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-emoji">الرمز التعبيري</Label>
              <Input
                id="p-emoji"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="🧪"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label>التقييم (1-5)</Label>
              <Select
                value={String(form.rating)}
                onValueChange={(v) => setForm({ ...form, rating: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {"★".repeat(r)} ({r})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-desc">الوصف</Label>
              <Textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف مختصر للمنتج وفوائده"
                rows={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-reasons">أسباب التوصية (افصلي بفاصلة)</Label>
              <Input
                id="p-reasons"
                value={form.reasons}
                onChange={(e) => setForm({ ...form, reasons: e.target.value })}
                placeholder="إشراقة فورية، يوحّد اللون، يحفّز الكولاجين"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-bestfor">يناسب (افصلي بفاصلة)</Label>
              <Input
                id="p-bestfor"
                value={form.bestFor}
                onChange={(e) => setForm({ ...form, bestFor: e.target.value })}
                placeholder="dryness, sensitivity, hydration"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2 pt-2">
              <Checkbox
                id="p-published"
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v === true })}
              />
              <Label htmlFor="p-published" className="cursor-pointer text-sm">
                منشور (ظاهر للمستخدمات)
              </Label>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="p-trending"
                checked={form.trending}
                onCheckedChange={(v) => setForm({ ...form, trending: v === true })}
              />
              <Label htmlFor="p-trending" className="cursor-pointer text-sm">
                🔥 ترند (يظهر في تبويب الترندات أعلى الصفحة)
              </Label>
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
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {editingId ? "حفظ التغييرات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import — plain text paste, no AI */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !bulkSubmitting && setBulkOpen(o)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto pretty-scroll">
          <DialogHeader>
            <DialogTitle>استيراد جماعي</DialogTitle>
            <DialogDescription>
              أضيفي عدة منتجات دفعة واحدة، كلها بنفس القسم والفئة الفرعية. تُنشأ كمسودات
              (غير منشورة) لتراجعيها وتضيفي الوصف/الصورة قبل النشر.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>القسم</Label>
                <Select
                  value={bulkDepartment}
                  onValueChange={(v) => {
                    const dep = v as ProductDepartment;
                    setBulkDepartment(dep);
                    setBulkCategory(categoriesForDepartment(dep)[0]?.id || "");
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_DEPARTMENTS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.emoji} {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الفئة الفرعية</Label>
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="اختاري..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesForDepartment(bulkDepartment).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>المنتجات — سطر لكل منتج</Label>
              <p className="text-xs text-muted-foreground">
                الصيغة: الاسم | البراند | السعر | رابط الشراء — العلامة والسعر والرابط اختيارية
              </p>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"عباية سوداء كلاسيكية | دار الأناقة | 350 SAR | https://...\nفستان سهرة أزرق | بوتيك رَونق | 480 SAR | https://..."}
                rows={8}
                dir="rtl"
                className="rounded-xl font-mono text-xs"
                disabled={bulkSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {bulkText.split("\n").filter((l) => l.trim()).length} سطر جاهز
              </p>
            </div>
            {bulkResult && (
              <p className="text-xs">
                <span className="text-emerald-500 font-bold">✓ {bulkResult.created} أُضيف</span>
                {bulkResult.failed > 0 && (
                  <span className="text-destructive font-bold mr-3">✗ {bulkResult.failed} فشل</span>
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkOpen(false)}
              disabled={bulkSubmitting}
              className="rounded-xl"
            >
              إغلاق
            </Button>
            <Button
              onClick={submitBulkImport}
              disabled={bulkSubmitting}
              className="rawnak-rosegold-gradient text-black font-bold rounded-xl gap-1.5"
            >
              {bulkSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              استيراد
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
              هل أنتِ متأكدة من حذف هذا المنتج؟ لا يمكن التراجع.
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
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
