"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Headset, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ThreadMessage {
  id: string;
  senderRole: "user" | "admin";
  senderName: string | null;
  text: string;
  createdAt: number;
}

export function SupportScreen() {
  const { setView, goBack } = useAppStore();
  const [assignedAdminName, setAssignedAdminName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await authedFetch("/api/support/thread");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setAssignedAdminName(json.assignedAdminName || null);
      setMessages(json.messages || []);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await authedFetch("/api/support/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الإرسال");
      setMessages((cur) => [
        ...cur,
        { id: `local-${Date.now()}`, senderRole: "user", senderName: null, text, createdAt: Date.now() },
      ]);
      setDraft("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="py-3 flex flex-col h-[calc(100dvh-7rem)]">
      <button
        onClick={() => { if (!goBack()) setView("profile"); }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0 mb-3"
      >
        <ChevronLeft className="w-4 h-4" />
        رجوع
      </button>

      <div className="flex items-center gap-2.5 mb-3 shrink-0">
        <div className="w-11 h-11 rounded-2xl rawnak-rosegold-gradient grid place-items-center shrink-0">
          <Headset className="w-5 h-5 text-black" />
        </div>
        <div>
          <h1 className="font-extrabold text-lg">الدعم</h1>
          <p className="text-xs text-muted-foreground">
            {assignedAdminName ? `تتحدثين مع ${assignedAdminName}` : "فريق رَونق سيتواصل معكِ قريبًا"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Headset className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-bold mb-1">تحتاجين مساعدة؟</p>
            <p className="text-sm text-muted-foreground">
              اكتبي رسالتكِ بالأسفل وسيردّ عليكِ فريق الدعم في أقرب وقت
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.senderRole === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                  m.senderRole === "user"
                    ? "rawnak-gradient rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 pt-2 border-t border-border shrink-0">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="اكتبي رسالتكِ..."
          className="min-h-[44px] max-h-32 text-sm rounded-xl resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          onClick={send}
          disabled={sending || !draft.trim()}
          size="icon"
          className="rounded-xl rawnak-rosegold-gradient text-black shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
