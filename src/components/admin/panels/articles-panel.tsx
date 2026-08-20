"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useState } from "react";
import { useAdminList } from "@/hooks/use-admin-list";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Newspaper,
  RefreshCw,
  Eye,
  Sparkles,
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
import {
  Article,
  parseList,
  formatDate,
} from "@/components/admin/admin-types";

interface ArticlesPanelProps {
  email: string;
}

interface ArticleForm {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  coverEmoji: string;
  readMinutes: number;
  bestFor: string;
  published: boolean;
}

const EMPTY_FORM: ArticleForm = {
  title: "",
  slug: "",
  category: "tips",
  excerpt: "",
  content: "",
  coverEmoji: "✨",
  readMinutes: 3,
  bestFor: "",
  published: true,
};

const ARTICLE_CATEGORIES = [
  { id: "tips", label: "نصائح" },
  { id: "education", label: "تثقيف" },
  { id: "skincare", label: "العناية بالبشرة" },
  { id: "makeup", label: "المكياج" },
  { id: "seasonal", label: "موسمي" },
];

function catLabel(id: string): string {
  return ARTICLE_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .slice(0, 60);
}

export function ArticlesPanel({ email }: ArticlesPanelProps) {
  const { data: articles, setData: setArticles, loading, reload: load } = useAdminList<Article>(
    "/api/admin/articles",
    email,
    "articles"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [importInput, setImportInput] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const handleImportArticle = async () => {
    if (!importInput.trim()) {
      toast.error("يرجى إدخال رابط المقال أو عنوان الموضوع التعليمي");
      return;
    }
    setFetchingUrl(true);
    try {
      const res = await fetch("/api/import-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrTopic: importInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر استيراد المقال");

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        slug: data.slug || prev.slug,
        category: data.category || prev.category,
        excerpt: data.excerpt || prev.excerpt,
        content: data.content || prev.content,
        coverEmoji: data.coverEmoji || prev.coverEmoji,
        readMinutes: typeof data.readMinutes === "number" ? data.readMinutes : prev.readMinutes,
        bestFor: Array.isArray(data.bestFor) ? data.bestFor.join("، ") : prev.bestFor,
      }));

      toast.success("تم استيراد وإنشاء الدرس والمقال بنجاح! ✦");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ في استيراد المقال");
    } finally {
      setFetchingUrl(false);
    }
  };

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(a: Article) {
    setForm({
      title: a.title,
      slug: a.slug,
      category: a.category,
      excerpt: a.excerpt || "",
      content: a.content || "",
      coverEmoji: a.coverEmoji || "✨",
      readMinutes: a.readMinutes,
      bestFor: (a.bestFor || []).join("، "),
      published: a.published,
    });
    setEditingId(a.id);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setSaving(true);
    try {
      const slug = form.slug.trim() || slugify(form.title);
      const payload = {
        title: form.title.trim(),
        slug,
        category: form.category,
        excerpt: form.excerpt.trim(),
        content: form.content,
        coverEmoji: form.coverEmoji.trim() || "✨",
        readMinutes: Number(form.readMinutes) || 3,
        bestFor: parseList(form.bestFor),
        published: form.published,
      };
      const isEdit = !!editingId;
      const res = await authedFetch("/api/admin/articles" + (isEdit ? `/${editingId}` : ""), {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحفظ");
      toast.success(isEdit ? "تم تحديث المقال ✦" : "تم إنشاء المقال ✦");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(a: Article) {
    try {
      const res = await authedFetch(`/api/admin/articles/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, published: !a.published }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      setArticles((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, published: !a.published } : x))
      );
      toast.success(a.published ? "أُخفي المقال" : "نُشر المقال");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await authedFetch(`/api/admin/articles/${deleteId}?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحذف");
      toast.success("تم حذف المقال");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setDeleting(false);
    }
  }

  const previewArticle = articles.find((a) => a.id === previewId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text">المقالات</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة مقالات المجلة التعليمية
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
            إضافة مقال
          </Button>
        </div>
      </div>

      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : articles.length === 0 ? (
            <div className="py-16 text-center">
              <Newspaper className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا توجد مقالات بعد. أضيفي أول مقال.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right">المقال</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الفئة</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">القراءة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">ال slug</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">تاريخ</TableHead>
                    <TableHead className="text-right">منشور</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((a) => (
                    <TableRow key={a.id} className="border-border/40">
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="w-9 h-9 rounded-lg rawnak-gradient flex items-center justify-center text-base shrink-0">
                            {a.coverEmoji || "✨"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[220px]">
                              {a.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                              {a.excerpt || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary" className="rounded-md">
                          {catLabel(a.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {a.readMinutes} د
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground" dir="ltr">
                        {a.slug}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {a.createdAt ? formatDate(a.createdAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={a.published}
                          onCheckedChange={() => togglePublished(a)}
                          aria-label="نشر"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewId(a.id)}
                            className="h-8 w-8 p-0"
                            aria-label="معاينة"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(a)}
                            className="h-8 w-8 p-0"
                            aria-label="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(a.id)}
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

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pretty-scroll">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المقال" : "إضافة مقال جديد"}</DialogTitle>
            <DialogDescription>
              اكتبي مقالًا تعليميًا يظهر للمستخدمات في المجلة.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Auto Import / AI Lesson Writer */}
            <div className="sm:col-span-2 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="a-import" className="text-xs font-bold flex items-center gap-1.5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  استيراد أو كتابة درس بالذكاء الاصطناعي (رابط مقال أو عنوان الموضوع)
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="a-import"
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="ضع رابط المقال أو اكتب موضوع الدرس (مثال: فوائد النياسيناميد والريتينول)..."
                  className="bg-background text-xs"
                />
                <Button
                  type="button"
                  onClick={handleImportArticle}
                  disabled={fetchingUrl}
                  variant="default"
                  className="shrink-0 text-xs font-bold gap-1.5 rawnak-gradient-btn"
                >
                  {fetchingUrl ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  توليد واستيراد
                </Button>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="a-title">العنوان *</Label>
              <Input
                id="a-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="كيف تبني روتين عناية صباحي؟"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-slug">الرابط (slug)</Label>
              <Input
                id="a-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="يُولّد تلقائيًا من العنوان"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">
                اتركيه فارغًا للتوليد التلقائي.
              </p>
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-emoji">الرمز التعبيري للغلاف</Label>
              <Input
                id="a-emoji"
                value={form.coverEmoji}
                onChange={(e) => setForm({ ...form, coverEmoji: e.target.value })}
                placeholder="✨"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-read">مدة القراءة (دقائق)</Label>
              <Input
                id="a-read"
                type="number"
                min={1}
                max={30}
                value={form.readMinutes}
                onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="a-excerpt">المقتطف</Label>
              <Textarea
                id="a-excerpt"
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="جملة أو جملتان تلخّصان المقال"
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="a-content">المحتوى</Label>
              <Textarea
                id="a-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="اكتبي محتوى المقال هنا..."
                className="min-h-48"
                rows={10}
              />
              <p className="text-[11px] text-muted-foreground">
                يدعم النص العادي. الفقرات بأسطر فارغة.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="a-bestfor">يناسب (افصلي بفاصلة)</Label>
              <Input
                id="a-bestfor"
                value={form.bestFor}
                onChange={(e) => setForm({ ...form, bestFor: e.target.value })}
                placeholder="dry, sensitive"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2 pt-2">
              <Checkbox
                id="a-published"
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v === true })}
              />
              <Label htmlFor="a-published" className="cursor-pointer text-sm">
                منشور (ظاهر للمستخدمات)
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
                <Newspaper className="w-4 h-4" />
              )}
              {editingId ? "حفظ التغييرات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto pretty-scroll">
          {previewArticle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl rawnak-gradient flex items-center justify-center text-2xl">
                    {previewArticle.coverEmoji || "✨"}
                  </div>
                  <div>
                    <DialogTitle className="text-xl leading-tight">
                      {previewArticle.title}
                    </DialogTitle>
                    <DialogDescription>
                      {catLabel(previewArticle.category)} · {previewArticle.readMinutes} دقائق قراءة
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              {previewArticle.excerpt && (
                <p className="text-sm text-muted-foreground italic border-r-2 border-primary/40 pr-3">
                  {previewArticle.excerpt}
                </p>
              )}
              <div className="whitespace-pre-wrap text-sm leading-7 bg-accent/30 rounded-xl p-4 max-h-[50vh] overflow-y-auto pretty-scroll">
                {previewArticle.content || "لا يوجد محتوى."}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنتِ متأكدة من حذف هذا المقال؟ لا يمكن التراجع.
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
