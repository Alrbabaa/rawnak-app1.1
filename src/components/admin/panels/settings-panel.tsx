"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Settings as SettingsIcon, ShieldAlert, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { FEATURE_LIMITS, type FeatureId } from "@/lib/features";

interface Settings {
  supportEmail: string;
  defaultCountry: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementEnabled: boolean;
  announcementText: string;
  aiLimits: Record<FeatureId, { freeUses: number; vipMonthlyCap: number; normalPeriodDays: number; vipPeriodDays: number }>;
}

interface SettingsPanelProps {
  email: string;
  viewerRole: "admin" | "super_admin";
}

export function SettingsPanel({ email, viewerRole }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = viewerRole === "super_admin";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authedFetch("/api/admin/settings");
        const json = await res.json();
        if (active && res.ok) setSettings(json.settings);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [email]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await authedFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "فشل الحفظ");
      toast.success("حُفظت الإعدادات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
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
          <SettingsIcon className="w-6 h-6" />
          إعدادات النظام
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          إعدادات عامة لرَونق — يديرها {canEdit ? "المسؤول الأعلى" : "المسؤول الأعلى فقط (للعرض هنا)"}
        </p>
      </div>

      <Card className="glass-card rounded-2xl border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            حدود الذكاء الاصطناعي أدناه فعّالة وتُطبّق من الخادم فور الحفظ. أما وضع الصيانة
            وشريط الإعلان فما زالا مخزّنين فقط ولم يُفعّلا في نسخة المستخدمات بعد.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">حدود استخدام الذكاء الاصطناعي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            المستخدم العادي لديه استخدام واحد يوميًا لكل ميزة ذكاء اصطناعي. يمكن التحكم بعدد استخدامات VIP من هنا، وتُعاد الحدود تلقائيًا كل يوم عند بداية اليوم الجديد.
          </p>
          <div className="space-y-2">
            {(Object.keys(FEATURE_LIMITS) as FeatureId[]).map((featureId) => (
              <div key={featureId} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_repeat(4,110px)] sm:items-end">
                <p className="text-sm font-semibold">{FEATURE_LIMITS[featureId].label}</p>
                <div className="space-y-1">
                  <Label className="text-[11px]">عدد العادي</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={settings.aiLimits[featureId].freeUses}
                    onChange={(e) => setSettings({
                      ...settings,
                      aiLimits: {
                        ...settings.aiLimits,
                        [featureId]: { ...settings.aiLimits[featureId], freeUses: Number(e.target.value) },
                      },
                    })}
                    disabled={!canEdit}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">دورة العادي (يوميًا)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={settings.aiLimits[featureId].normalPeriodDays}
                    disabled
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">عدد VIP</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={settings.aiLimits[featureId].vipMonthlyCap}
                    onChange={(e) => setSettings({
                      ...settings,
                      aiLimits: {
                        ...settings.aiLimits,
                        [featureId]: { ...settings.aiLimits[featureId], vipMonthlyCap: Number(e.target.value) },
                      },
                    })}
                    disabled={!canEdit}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">دورة VIP (أيام)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={settings.aiLimits[featureId].vipPeriodDays}
                    onChange={(e) => setSettings({
                      ...settings,
                      aiLimits: {
                        ...settings.aiLimits,
                        [featureId]: { ...settings.aiLimits[featureId], vipPeriodDays: Number(e.target.value) },
                      },
                    })}
                    disabled={!canEdit}
                    className="rounded-xl"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">عام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>بريد الدعم</Label>
              <Input
                dir="ltr"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                placeholder="support@rawnak.app"
                disabled={!canEdit}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>الدولة الافتراضية</Label>
              <Input
                value={settings.defaultCountry}
                onChange={(e) => setSettings({ ...settings, defaultCountry: e.target.value })}
                disabled={!canEdit}
                className="rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card rounded-2xl border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            وضع الصيانة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="maint" className="cursor-pointer">
              تفعيل وضع الصيانة (مخزَّن فقط حاليًا — غير مُفعَّل في التطبيق)
            </Label>
            <Switch
              id="maint"
              checked={settings.maintenanceMode}
              onCheckedChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label>رسالة الصيانة</Label>
            <Textarea
              value={settings.maintenanceMessage}
              onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
              rows={2}
              dir="rtl"
              disabled={!canEdit}
              className="rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">شريط إعلان (قادم)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="ann" className="cursor-pointer">
              تفعيل شريط الإعلان (مخزَّن فقط حاليًا)
            </Label>
            <Switch
              id="ann"
              checked={settings.announcementEnabled}
              onCheckedChange={(v) => setSettings({ ...settings, announcementEnabled: v })}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label>نص الإعلان</Label>
            <Textarea
              value={settings.announcementText}
              onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
              rows={2}
              dir="rtl"
              placeholder="مثال: عروض رمضان بدأت الآن ✦"
              disabled={!canEdit}
              className="rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Button
          onClick={save}
          disabled={saving}
          className="rawnak-rosegold-gradient text-black font-bold rounded-xl gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </Button>
      )}
    </div>
  );
}
