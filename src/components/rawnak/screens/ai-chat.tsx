"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Send, Sparkles, Trash2, User, Volume2, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/hooks/use-speech";
import { useRealWeather } from "@/hooks/use-real-weather";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SUGGESTIONS = [
  "ما أفضل روتين لبشرتي؟",
  "كيف أتعامل مع الهالات السوداء؟",
  "ما هو الريتينول وكيف أستخدمه؟",
  "نصيحة لبشرة أكثر إشراقًا",
];

/**
 * A companion who actually notices you, not a static "hello" box: the
 * greeting adapts to time of day and, when there's something real to
 * reference (a streak, a recent analysis), speaks to it warmly. Deliberately
 * NOT trying to maximize time-in-app — just making the first thing she sees
 * feel personal instead of generic.
 */
function companionGreeting(opts: {
  name: string;
  streak: number;
  lastAnalysis?: { overall: number; ts: number };
}): { title: string; subtitle: string; suggestion?: string } {
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 5 ? "سهرانة لحالكِ؟" : hour < 12 ? "صباح الخير" : hour < 18 ? "مساء النور" : "مساء الخير";
  const name = opts.name || "جميلتي";

  const daysSinceAnalysis = opts.lastAnalysis
    ? Math.floor((Date.now() - opts.lastAnalysis.ts) / (24 * 60 * 60 * 1000))
    : null;

  if (opts.streak >= 3) {
    return {
      title: `${timeGreeting}، ${name} ♡`,
      subtitle: `يومكِ الـ${opts.streak} معي على التوالي — فخورة بالتزامكِ ✦`,
      suggestion: "قوليلي، وش أقدر أساعدكِ فيه اليوم؟",
    };
  }

  if (daysSinceAnalysis !== null && daysSinceAnalysis <= 3) {
    return {
      title: `${timeGreeting}، ${name} ♡`,
      subtitle:
        daysSinceAnalysis === 0
          ? `لسه فاكرة تحليلكِ الأخير (${opts.lastAnalysis!.overall}/100) — شلون حاسة بشرتكِ اليوم؟`
          : `تحليلكِ الأخير كان ${opts.lastAnalysis!.overall}/100 — جاهزة نطوّر روتينكِ أكثر؟`,
      suggestion: "طوّري لي روتيني بناءً على تحليلي الأخير",
    };
  }

  return {
    title: `${timeGreeting}، ${name} ♡`,
    subtitle:
      "أنا رَونق، خبيرة الجمال الشخصية لديكِ. اسأليني أي شيء عن العناية ببشرتكِ، المكونات، الروتين، أو المكياج.",
  };
}

/**
 * A weather-aware opener — proactively surfacing a real, current condition
 * (heat, cold, sun, humidity) instead of waiting for her to think of a
 * question. Only returned for conditions that actually change a skincare
 * routine; mild weather stays quiet rather than forcing a suggestion.
 */
function weatherSuggestion(tempC: number, label: string): string | null {
  if (label.includes("مشمس") || label.includes("صافٍ")) {
    return "الجو مشمس اليوم — كيف أحمي بشرتي من أشعة الشمس؟";
  }
  if (tempC >= 35) {
    return `الجو حار جدًا اليوم (${tempC}°) — وش أسوي عشان بشرتي ما تتأثر بالحر والتعرّق؟`;
  }
  if (tempC <= 12) {
    return `الجو بارد اليوم (${tempC}°) — كيف أعتني ببشرتي من الجفاف في هالطقس؟`;
  }
  if (label.includes("ممطر") || label.includes("رذاذ") || label.includes("ضبابي")) {
    return "الجو رطب اليوم — هل يغيّر هذا روتين بشرتي؟";
  }
  return null;
}

export function AiChat() {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    profile,
    analyses,
    cabinet,
    streak,
    unlockAchievement,
    setView,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();
  const { status: weatherStatus, weather } = useRealWeather();
  const weatherPrompt =
    weatherStatus === "ready" && weather
      ? weatherSuggestion(weather.tempC, weather.label)
      : null;

  const latestAnalysis = analyses[0]
    ? {
        overall: analyses[0].overall,
        skinType: analyses[0].skinType,
        summary: analyses[0].summary,
      }
    : null;

  // Computed once per mount (deliberately not reactive to the clock ticking)
  // so the greeting doesn't shift mid-conversation.
  const [greeting] = useState(() =>
    companionGreeting({
      name: profile.name || "",
      streak,
      lastAnalysis: analyses[0] ? { overall: analyses[0].overall, ts: analyses[0].ts } : undefined,
    })
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, loading]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;

    // How long since she was last actually here — lets the AI notice a real
    // gap (days away) and welcome her back naturally, instead of answering
    // cold as if no time passed. Measured against the last message BEFORE
    // this new one, so it reflects an actual return, not the current send.
    const priorMessages = chatMessages.filter((m) => m.role === "user" || m.role === "assistant");
    const lastMsgTs = priorMessages[priorMessages.length - 1]?.ts;
    const hoursSinceLastMessage = lastMsgTs
      ? Math.round((Date.now() - lastMsgTs) / (60 * 60 * 1000))
      : null;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user" as const,
      content: msg,
      ts: Date.now(),
    };
    addChatMessage(userMsg);
    setInput("");
    setLoading(true);

    try {
      const res = await authedFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          hoursSinceLastMessage,
          history: chatMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content })),
          profile: {
            name: profile.name,
            age: profile.age,
            skinType: profile.skinType,
            skinTone: profile.skinTone,
            concerns: profile.concerns,
            goals: profile.goals,
            makeupLevel: profile.makeupLevel,
            personalityMode: profile.personalityMode,
            dialect: profile.dialect,
          },
          cabinetProducts: cabinet.map((c) => c.name).slice(0, 20),
          latestAnalysis,
          streak,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgradeRequired) {
          addChatMessage({
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "استخدمتِ تجربتكِ المجانية من الدردشة معي ✦ رقّي لعضوية VIP لمتابعة المحادثة بلا حدود.",
            ts: Date.now(),
          });
          setView("vip");
          return;
        }
        throw new Error(data.error || "خطأ");
      }

      addChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.response,
        ts: Date.now(),
      });
      unlockAchievement("first-chat");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
      addChatMessage({
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          "عذرًا، واجهتُ صعوبة الآن. حاولي مرة أخرى بعد لحظات ♡",
        ts: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-1 py-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-full rawnak-rose-gradient grid place-items-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div>
            <p className="font-bold text-sm">خبيرة الجمال رَونق</p>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              متاحة الآن
              {profile.personalityMode === "romantic" && (
                <span className="px-1.5 py-0.5 rounded-full rawnak-rosegold-gradient text-black text-[9px] font-bold">
                  ♡ رومانسي
                </span>
              )}
            </p>
          </div>
        </div>
        {chatMessages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
                aria-label="مسح المحادثة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>مسح المحادثة؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حذف كل رسائل هذه المحادثة نهائيًا ولا يمكن التراجع عن ذلك.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    speech.stop();
                    clearChat();
                    toast("تم مسح المحادثة");
                  }}
                >
                  مسح نهائيًا
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pretty-scroll space-y-3 px-1"
      >
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center text-center py-8">
            <img
              src="/rawnak-logo.jpg"
              alt="رَونق"
              className="w-14 h-14 rounded-2xl object-cover rawnak-glow"
            />
            <h3 className="mt-4 text-lg font-bold">{greeting.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {greeting.subtitle}
            </p>
            <div className="mt-6 w-full space-y-2">
              {greeting.suggestion && (
                <button
                  onClick={() => send(greeting.suggestion!)}
                  className="w-full text-right p-3 rounded-2xl rawnak-rosegold-gradient text-black text-sm font-bold"
                >
                  {greeting.suggestion}
                </button>
              )}
              {weatherPrompt && (
                <button
                  onClick={() => send(weatherPrompt)}
                  className="w-full text-right p-3 rounded-2xl bg-card border border-primary/30 hover:border-primary/50 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <span>{weather?.emoji}</span>
                  {weatherPrompt}
                </button>
              )}
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-right p-3 rounded-2xl bg-card border border-border hover:border-primary/40 transition-colors text-sm font-medium"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {chatMessages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-2.5 max-w-[90%]",
                m.role === "user" ? "flex-row-reverse mr-auto" : "ml-auto"
              )}
            >
              {m.role === "assistant" ? (
                <div className="w-8 h-8 rounded-full rawnak-rose-gradient grid place-items-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted grid place-items-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  "[&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold",
                  "[&_ul]:list-disc [&_ul]:pr-4 [&_ul]:mb-2 [&_ul]:space-y-0.5",
                  "[&_ol]:list-decimal [&_ol]:pr-4 [&_ol]:mb-2 [&_ol]:space-y-0.5",
                  "[&_a]:underline [&_a]:font-medium",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
                    : "bg-card border border-border rounded-tl-sm"
                )}
              >
                {m.role === "assistant" ? (
                  <>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                    {speech.supported && (
                      <button
                        onClick={() => speech.speak(m.id, m.content)}
                        className={cn(
                          "flex items-center gap-1 text-[11px] mt-1.5 pt-1.5 border-t border-border/60 text-muted-foreground hover:text-foreground transition-colors",
                          speech.speakingId === m.id && "text-primary"
                        )}
                      >
                        {speech.speakingId === m.id ? (
                          <>
                            <Square className="w-3 h-3" fill="currentColor" />
                            إيقاف
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            استمعي
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex gap-2.5 max-w-[90%] ml-auto">
            <div className="w-8 h-8 rounded-full rawnak-rose-gradient grid place-items-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-card border border-border rounded-tl-sm flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot w-2 h-2 rounded-full bg-primary"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتبي رسالتكِ..."
            disabled={loading}
            className="flex-1 h-12 px-4 rounded-2xl bg-card border border-border text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-12 h-12 rounded-2xl rawnak-rose-gradient grid place-items-center text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md"
            aria-label="إرسال"
          >
            <Send className="w-5 h-5 -scale-x-100" />
          </button>
        </form>
      </div>
    </div>
  );
}
