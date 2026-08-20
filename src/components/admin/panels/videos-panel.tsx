"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useState } from "react";
import { useAdminList } from "@/hooks/use-admin-list";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Video as VideoIcon,
  RefreshCw,
  Star,
  Play,
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
import { cn } from "@/lib/utils";
import { VIDEO_CATEGORIES } from "@/lib/data";
import {
  Video,
  parseList,
} from "@/components/admin/admin-types";

interface VideosPanelProps {
  email: string;
}

interface VideoForm {
  title: string;
  youtubeId: string;
  category: string;
  channel: string;
  duration: string;
  description: string;
  thumbnail: string;
  featured: boolean;
  published: boolean;
  relatedProductNames: string;
  bestFor: string;
  keyTakeaways: string;
}

const EMPTY_FORM: VideoForm = {
  title: "",
  youtubeId: "",
  category: "skincare",
  channel: "",
  duration: "",
  description: "",
  thumbnail: "",
  featured: false,
  published: true,
  relatedProductNames: "",
  bestFor: "",
  keyTakeaways: "",
};

function catLabel(id: string): string {
  return VIDEO_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function catEmoji(id: string): string {
  return VIDEO_CATEGORIES.find((c) => c.id === id)?.emoji || "🎬";
}

export function VideosPanel({ email }: VideosPanelProps) {
  const { data: videos, setData: setVideos, loading, reload: load } = useAdminList<Video>(
    "/api/admin/videos",
    email,
    "videos"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VideoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [importInput, setImportInput] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const handleImportVideo = async () => {
    if (!importInput.trim()) {
      toast.error("يرجى إدخال رابط يوتيوب أو عنوان/موضوع الدرس");
      return;
    }
    setFetchingUrl(true);
    try {
      const res = await fetch("/api/import-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrTopic: importInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر استيراد الفيديو");

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        youtubeId: data.youtubeId || prev.youtubeId,
        category: data.category || prev.category,
        channel: data.channel || prev.channel,
        duration: data.duration || prev.duration,
        description: data.description || prev.description,
        thumbnail: data.thumbnail || prev.thumbnail,
        relatedProductNames: Array.isArray(data.relatedProductNames)
          ? data.relatedProductNames.join("، ")
          : prev.relatedProductNames,
        bestFor: Array.isArray(data.bestFor) ? data.bestFor.join("، ") : prev.bestFor,
        keyTakeaways: Array.isArray(data.keyTakeaways)
          ? data.keyTakeaways.join("\n")
          : prev.keyTakeaways,
      }));

      if (!data.youtubeId) {
        toast.warning(data.warning || "لم يتم العثور على رابط يوتيوب صالح — أضيفي معرّف الفيديو الحقيقي يدويًا قبل الحفظ.");
      } else {
        toast.success("تم استيراد الفيديو — يرجى مراجعة الوصف وأهم الخطوات المولّدة تلقائيًا قبل الحفظ ✦");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ في استيراد الفيديو");
    } finally {
      setFetchingUrl(false);
    }
  };

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(v: Video) {
    setForm({
      title: v.title,
      youtubeId: v.youtubeId,
      category: v.category,
      channel: v.channel,
      duration: v.duration,
      description: v.description || "",
      thumbnail: v.thumbnail || "",
      featured: v.featured,
      published: v.published,
      relatedProductNames: (v.relatedProductNames || []).join("، "),
      bestFor: (v.bestFor || []).join("، "),
      keyTakeaways: (v.keyTakeaways || []).join("\n"),
    });
    setEditingId(v.id);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title.trim() || !form.youtubeId.trim()) {
      toast.error("العنوان ومعرّف يوتيوب مطلوبان");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        youtubeId: form.youtubeId.trim(),
        category: form.category,
        channel: form.channel.trim(),
        duration: form.duration.trim(),
        description: form.description.trim(),
        thumbnail: form.thumbnail.trim() || null,
        featured: form.featured,
        relatedProductNames: parseList(form.relatedProductNames),
        bestFor: parseList(form.bestFor),
        keyTakeaways: parseList(form.keyTakeaways),
        published: form.published,
      };
      const isEdit = !!editingId;
      const res = await authedFetch("/api/admin/videos" + (isEdit ? `/${editingId}` : ""), {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحفظ");
      toast.success(isEdit ? "تم تحديث الفيديو ✦" : "تم إنشاء الفيديو ✦");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(v: Video) {
    try {
      const res = await authedFetch(`/api/admin/videos/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, published: !v.published }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحديث");
      setVideos((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, published: !v.published } : x))
      );
      toast.success(v.published ? "أُخفي الفيديو" : "نُشر الفيديو");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await authedFetch(`/api/admin/videos/${deleteId}?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الحذف");
      toast.success("تم حذف الفيديو");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setDeleting(false);
    }
  }

  const thumb = form.youtubeId.trim()
    ? `https://img.youtube.com/vi/${form.youtubeId.trim()}/hqdefault.jpg`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text">أكاديمية الجمال</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة مكتبة الفيديوهات التعليمية
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
            إضافة فيديو
          </Button>
        </div>
      </div>

      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : videos.length === 0 ? (
            <div className="py-16 text-center">
              <VideoIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">لا توجد فيديوهات بعد. أضيفي أول فيديو.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right">الفيديو</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الفئة</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">القناة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">المدة</TableHead>
                    <TableHead className="text-right hidden md:table-cell">مميّز</TableHead>
                    <TableHead className="text-right">منشور</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v) => (
                    <TableRow key={v.id} className="border-border/40">
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="relative w-14 h-10 rounded-md overflow-hidden shrink-0 bg-accent">
                            <img
                              src={`https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`}
                              alt={v.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[200px]">
                              {v.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground" dir="ltr">
                              {v.youtubeId}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary" className="rounded-md">
                          {catEmoji(v.category)} {catLabel(v.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {v.channel || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {v.duration || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {v.featured ? (
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={v.published}
                          onCheckedChange={() => togglePublished(v)}
                          aria-label="نشر"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(v)}
                            className="h-8 w-8 p-0"
                            aria-label="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(v.id)}
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
            <DialogTitle>{editingId ? "تعديل الفيديو" : "إضافة فيديو جديد"}</DialogTitle>
            <DialogDescription>
              أدخلي بيانات الفيديو من يوتيوب ليظهر في الأكاديمية.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Auto Import by YouTube Link or Topic */}
            <div className="sm:col-span-2 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="v-import" className="text-xs font-bold flex items-center gap-1.5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  استيراد ذكي بالفيديو (رابط يوتيوب أو موضوع الدرس)
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="v-import"
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="ضع رابط يوتيوب (مثال: https://youtu.be/...) أو اكتب عنوان الدرس..."
                  className="bg-background text-xs"
                  dir="ltr"
                />
                <Button
                  type="button"
                  onClick={handleImportVideo}
                  disabled={fetchingUrl}
                  variant="default"
                  className="shrink-0 text-xs font-bold gap-1.5 rawnak-gradient-btn"
                >
                  {fetchingUrl ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  استيراد ذكي
                </Button>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-title">العنوان *</Label>
              <Input
                id="v-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="روتين العناية بالبشرة للبنات"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-ytid">معرّف يوتيوب *</Label>
              <Input
                id="v-ytid"
                value={form.youtubeId}
                onChange={(e) => setForm({ ...form, youtubeId: e.target.value })}
                placeholder="8mQk1lG3JfE"
                dir="ltr"
              />
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
                  {VIDEO_CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-channel">القناة</Label>
              <Input
                id="v-channel"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                placeholder="Skin Care Arabia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-duration">المدة</Label>
              <Input
                id="v-duration"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="12:30"
                dir="ltr"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-thumb">رابط الصورة المصغّرة (اختياري)</Label>
              <Input
                id="v-thumb"
                value={form.thumbnail}
                onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                placeholder="https://..."
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">
                إذا تُرك فارغًا، ستُستخدم صورة يوتيوب الافتراضية.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-desc">الوصف</Label>
              <Textarea
                id="v-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف موجز لمحتوى الفيديو"
                rows={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-takeaways">أهم خطوات هذا الفيديو تحديدًا (سطر لكل نقطة)</Label>
              <Textarea
                id="v-takeaways"
                value={form.keyTakeaways}
                onChange={(e) => setForm({ ...form, keyTakeaways: e.target.value })}
                placeholder={"نظفي البشرة قبل السيروم\nطبّقي الترطيب خلال دقيقة من الغسول"}
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                إن أُدرِجت عبر "الاستيراد الذكي" فهي مبنية على عنوان الفيديو فقط وليست مشاهدة فعلية له —
                يرجى مراجعتها لتُطابق محتوى الفيديو الحقيقي. اتركي الحقل فارغًا إن لم تكوني متأكدة؛ الدرس
                سيعرض حينها حالة "لا يوجد ملخص بعد" بدل معلومات غير دقيقة.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-related">منتجات ذات صلة (افصلي بفاصلة)</Label>
              <Input
                id="v-related"
                value={form.relatedProductNames}
                onChange={(e) => setForm({ ...form, relatedProductNames: e.target.value })}
                placeholder="غسول لطيف، سيروم فيتامين سي"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-bestfor">يناسب (افصلي بفاصلة)</Label>
              <Input
                id="v-bestfor"
                value={form.bestFor}
                onChange={(e) => setForm({ ...form, bestFor: e.target.value })}
                placeholder="normal, combination"
                dir="ltr"
              />
            </div>

            {/* Thumbnail preview */}
            {thumb && (
              <div className="sm:col-span-2">
                <Label>معاينة الصورة المصغّرة</Label>
                <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden bg-accent">
                  <img
                    src={thumb}
                    alt="معاينة"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0.3";
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="v-featured"
                checked={form.featured}
                onCheckedChange={(v) => setForm({ ...form, featured: v === true })}
              />
              <Label htmlFor="v-featured" className="cursor-pointer text-sm">
                فيديو مميّز ⭐
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="v-published"
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v === true })}
              />
              <Label htmlFor="v-published" className="cursor-pointer text-sm">
                منشور
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
                <VideoIcon className="w-4 h-4" />
              )}
              {editingId ? "حفظ التغييرات" : "إضافة"}
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
              هل أنتِ متأكدة من حذف هذا الفيديو؟ لا يمكن التراجع.
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
