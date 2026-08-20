"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Loader2, Check, Circle } from "lucide-react";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { type BuddyStatus } from "@/lib/buddy";

/**
 * Self-contained "صديقة التوهج" card for invite-screen.tsx. Deliberately
 * isolated from the referral code above it (own fetch, own loading state)
 * so this new, less-proven feature can never break the existing referral
 * flow if something here fails — it just shows its own error state.
 *
 * Only ever renders a boolean about the buddy (done today / not yet) —
 * see src/lib/buddy.ts for why that boundary matters.
 */
export function BuddyCard() {
  const [status, setStatus] = useState<BuddyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [linking, setLinking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/buddy/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      // Leave status null — card shows nothing rather than a broken state.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const handleLink = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setLinking(true);
    try {
      const res = await authedFetch("/api/buddy/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "تعذّر الربط، تأكدي من الكود");
        return;
      }
      toast.success(`أصبحتِ وَ${data.buddyName} صديقتَي توهج ✦`);
      setCodeInput("");
      await load();
    } catch {
      toast.error("تعذّر الربط، حاولي مرة أخرى");
    } finally {
      setLinking(false);
    }
  };

  const handleCopyCode = async () => {
    if (!status?.myCode) return;
    try {
      await navigator.clipboard.writeText(status.myCode);
      toast.success("تم نسخ كود صديقة التوهج ✦");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  if (loading) {
    return (
      <Card className="p-5 rounded-3xl border-border flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!status) return null; // fetch failed — fail quietly, referral card above still works

  return (
    <Card className="p-5 rounded-3xl border-border">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">صديقة التوهج ✦</h3>
      </div>

      {status.hasBuddy ? (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">أنتِ اليوم</span>
            <span className="flex items-center gap-1.5 font-semibold">
              {status.meDoneToday ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              {status.meDoneToday ? "أنجزتِ روتينكِ" : "لم تنجزي بعد"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{status.buddyName}</span>
            {status.pairPredatesToday ? (
              <span className="flex items-center gap-1.5 font-semibold">
                {status.buddyDoneToday ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                {status.buddyDoneToday ? "أنجزت روتينها" : "لم تنجز بعد"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">بدءًا من الغد</span>
            )}
          </div>
          {!status.buddyDoneToday && status.pairPredatesToday && (
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border mt-1">
              ذكّري {status.buddyName} بروتين الليلة ✦
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            اربطي روتينكِ بروتين صديقة — لو فوّتت يومها تشوفين تذكيرًا، ولو فوّتِ تشوف هي
          </p>
          <div className="flex gap-2">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="كود صديقتكِ"
              dir="ltr"
              className="rounded-xl h-10 text-center tracking-widest"
              maxLength={6}
            />
            <Button
              onClick={handleLink}
              disabled={linking || !codeInput.trim()}
              className="rounded-xl h-10 px-4 shrink-0"
            >
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : "ربط"}
            </Button>
          </div>
          {status.myCode && (
            <button
              onClick={handleCopyCode}
              className="w-full text-center text-xs text-muted-foreground pt-1"
            >
              أو شاركي كودكِ معها: <span dir="ltr" className="font-bold tracking-widest">{status.myCode}</span>
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
