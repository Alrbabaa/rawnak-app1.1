"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Headset, Loader2, Send, RefreshCw, UserCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/components/admin/admin-types";

interface ThreadSummary {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  status: string;
  lastMessageAt: number | null;
  lastMessagePreview: string;
  lastSenderRole: "user" | "admin";
  unreadForAdmin: boolean;
  assignedAdminId?: string | null;
  assignedAdminName?: string | null;
}

interface ThreadMessage {
  id: string;
  senderRole: "user" | "admin";
  senderName: string | null;
  text: string;
  createdAt: number;
}

interface SupportPanelProps {
  viewerRole: "admin" | "super_admin";
}

/**
 * "الدعم" — every admin's inbox of the customers a super_admin has
 * personally assigned to them (see the "خدمة العملاء" column in Users
 * panel). A super_admin sees every thread here, including unassigned
 * ones, but assigning still only happens in Users panel — this stays a
 * pure inbox, not a second place to manage assignment.
 */
export function SupportPanel({ viewerRole }: SupportPanelProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/support");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setThreads(json.threads || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadThreads);
  }, []);

  async function openThread(userId: string) {
    setActiveUserId(userId);
    setLoadingMessages(true);
    try {
      const res = await authedFetch(`/api/admin/support/${userId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل التحميل");
      setMessages(json.messages || []);
      setThreads((cur) => cur.map((t) => (t.userId === userId ? { ...t, unreadForAdmin: false } : t)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !activeUserId) return;
    setSending(true);
    try {
      const res = await authedFetch(`/api/admin/support/${activeUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "فشل الإرسال");
      setMessages((cur) => [
        ...cur,
        { id: `local-${Date.now()}`, senderRole: "admin", senderName: null, text, createdAt: Date.now() },
      ]);
      setDraft("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSending(false);
    }
  }

  const activeThread = threads.find((t) => t.userId === activeUserId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold rawnak-gold-text">الدعم</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {viewerRole === "super_admin"
              ? "كل محادثات خدمة العملاء — بما فيها غير المُسندة"
              : "محادثات المستخدمات المُسندات إليكِ فقط"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadThreads} className="rounded-xl gap-1.5">
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <Card className="glass-card rounded-2xl overflow-hidden">
          <CardContent className="p-0 max-h-[560px] overflow-y-auto pretty-scroll">
            {loading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : threads.length === 0 ? (
              <div className="py-14 text-center px-4">
                <Headset className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {viewerRole === "admin" ? "لا مستخدمات مُسندة إليكِ بعد" : "لا محادثات بعد"}
                </p>
              </div>
            ) : (
              threads.map((t, i) => (
                <motion.button
                  key={t.userId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  onClick={() => openThread(t.userId)}
                  className={cn(
                    "w-full text-right p-3 border-b border-border/40 hover:bg-muted/40 transition-colors",
                    activeUserId === t.userId && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold truncate">{t.userName || t.userEmail || "مستخدمة"}</span>
                    {t.unreadForAdmin && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.lastSenderRole === "admin" ? "أنتِ: " : ""}
                    {t.lastMessagePreview}
                  </p>
                  {viewerRole === "super_admin" && (
                    <p className="text-[10px] mt-1">
                      {t.assignedAdminName ? (
                        <span className="text-muted-foreground">مُسندة إلى {t.assignedAdminName}</span>
                      ) : (
                        <span className="text-amber-500 font-bold">غير مُسندة</span>
                      )}
                    </p>
                  )}
                </motion.button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl overflow-hidden flex flex-col">
          {!activeUserId ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">اختاري محادثة لعرضها</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3.5 border-b border-border/40 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full rawnak-gradient flex items-center justify-center shrink-0">
                  <UserCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">
                    {activeThread?.userName || activeThread?.userEmail || "مستخدمة"}
                  </p>
                  {activeThread?.userEmail && (
                    <p className="text-[11px] text-muted-foreground truncate" dir="ltr">
                      {activeThread.userEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pretty-scroll p-4 space-y-2.5 max-h-[420px]">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.senderRole === "admin" ? "justify-start" : "justify-end")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                          m.senderRole === "admin"
                            ? "rawnak-gradient rounded-bl-sm"
                            : "bg-muted rounded-br-sm"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <p className="text-[10px] opacity-60 mt-1">{formatDate(new Date(m.createdAt).toISOString())}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-border/40 flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="اكتبي ردًا..."
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
            </>
          )}
        </Card>
      </div>

      {threads.some((t) => !t.assignedAdminId) && viewerRole === "super_admin" && (
        <p className="text-xs text-muted-foreground">
          المحادثات "غير المُسندة" تظهر لكِ فقط — أسنديها لمسؤولة من تبويب "المستخدمون" ليتابعها فريق خدمة العملاء.
        </p>
      )}
    </div>
  );
}
