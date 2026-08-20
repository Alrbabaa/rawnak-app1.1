"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Search, Sparkles, Filter, RotateCcw, CheckCheck, CloudCheck, Mic, MicOff, Volume2, Radio } from "lucide-react";
import { SKIN_CONCERNS } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { triggerSelectionHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { cn } from "@/lib/utils";

export interface SkinConcernsGridProps {
  selectedConcerns: string[];
  onToggleConcern: (id: string) => void;
  onSetConcerns?: (concerns: string[]) => void;
  showSaveIndicator?: boolean;
}

const CATEGORIES = [
  "الكل",
  "البثور والزيوت",
  "الترطيب والحاجز",
  "التوحيد والإشراق",
  "النضارة والشباب",
  "العناية بالعينين",
] as const;

// Arabic keyword dictionary to map spoken words to skin concern IDs
const CONCERN_SPEECH_MAP: { keywords: string[]; concernId: string }[] = [
  { keywords: ["بثور", "حبوب", "حب الشباب", "حب", "رؤوس سوداء", "مسام"], concernId: "acne" },
  { keywords: ["جفاف", "قشور", "ناشفة", "مشدودة", "عطشانة"], concernId: "dryness" },
  { keywords: ["تصبغات", "بقع", "كلف", "لون غير موحد", "اسمرار"], concernId: "pigmentation" },
  { keywords: ["تجاعيد", "خطوط", "ترهل", "علامات تقدم", "شيخوخة"], concernId: "wrinkles" },
  { keywords: ["هالات", "انتفاخ", "تحت العين", "عيون"], concernId: "dark_circles" },
  { keywords: ["احمرار", "تهيج", "حساسة", "حساسية", "احمرار البشرة"], concernId: "redness" },
  { keywords: ["شحوب", "باهتة", "بدون نضارة", "تعبانة"], concernId: "dullness" },
  { keywords: ["دهون", "زيتية", "لمعان", "افرازات"], concernId: "oily" },
];

export function SkinConcernsGrid({
  selectedConcerns,
  onToggleConcern,
  onSetConcerns,
  showSaveIndicator = true,
}: SkinConcernsGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSavingToFirestore, setIsSavingToFirestore] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Voice Input & Animation States
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Sync to Firestore in background
  const saveToFirestoreProfile = async (newConcerns: string[]) => {
    try {
      setIsSavingToFirestore(true);
      await authedFetch("/api/db/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { concerns: newConcerns },
        }),
      });
      setLastSavedTime("محفوظ في حسابكِ الحسابي ✦");
    } catch {
      // Silent error fallback for offline state
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  // Process text from voice (either recognized or simulated) with typing wave animation
  const processSpokenText = (text: string) => {
    setIsTyping(true);
    setVoiceFeedback("جاري تحليل ومقاطعة كلماتكِ لاستخراج مشاكل البشرة...");
    triggerSelectionHaptic();

    // Simulated character-by-character typing animation into search query
    let charIndex = 0;
    setSearchQuery("");
    const timer = setInterval(() => {
      if (charIndex < text.length) {
        setSearchQuery(text.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(timer);
        setIsTyping(false);

        // Detect and auto-select matching concerns
        const matchedIds: string[] = [];
        const lowerText = text.toLowerCase();
        CONCERN_SPEECH_MAP.forEach((item) => {
          if (item.keywords.some((kw) => lowerText.includes(kw))) {
            matchedIds.push(item.concernId);
          }
        });

        if (matchedIds.length > 0) {
          triggerSuccessHaptic();
          const combined = Array.from(new Set([...selectedConcerns, ...matchedIds]));
          if (onSetConcerns) {
            onSetConcerns(combined);
            saveToFirestoreProfile(combined);
          } else {
            matchedIds.forEach((id) => {
              if (!selectedConcerns.includes(id)) {
                onToggleConcern(id);
              }
            });
          }
          setVoiceFeedback(`تم تحديد ${matchedIds.length} من المشاكل المستخرجة تلقائياً ✨`);
        } else {
          setVoiceFeedback("تم كتابة ملاحظتكِ بنجاح في صندوق البحث ✨");
        }
      }
    }, 40);
  };

  // Initialize Speech Recognition if supported
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "ar-SA";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setVoiceText(currentTranscript);
        };

        recognition.onerror = () => {
          setIsListening(false);
          setVoiceFeedback("لم نتمكن من التقاط الصوت بدقة، يمكنكِ استخدام الأزرار الصوتية للتجربة.");
        };

        recognition.onend = () => {
          setIsListening(false);
          if (voiceText.trim()) {
            processSpokenText(voiceText);
          }
        };

        recognitionRef.current = recognition;
      }
    }
  }, [voiceText]);

  // Toggle Microphone
  const toggleListening = () => {
    triggerSelectionHaptic();
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      setVoiceText("");
      setVoiceFeedback(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          // Fallback if recognition is already running or blocked
          setIsListening(true);
        }
      } else {
        // Fallback simulation for environments without WebSpeech API
        setIsListening(true);
      }
    }
  };

  // Preset Spoken Phrases for fast voice feature demonstration
  const handlePresetVoiceSample = (phrase: string) => {
    setIsListening(false);
    setVoiceText(phrase);
    processSpokenText(phrase);
  };

  const filteredConcerns = useMemo(() => {
    return SKIN_CONCERNS.filter((c) => {
      const matchesCategory =
        activeCategory === "الكل" || c.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        c.label.includes(searchQuery) ||
        c.desc.includes(searchQuery) ||
        c.category.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleToggle = (id: string) => {
    triggerSelectionHaptic();
    onToggleConcern(id);
    const updated = selectedConcerns.includes(id)
      ? selectedConcerns.filter((item) => item !== id)
      : [...selectedConcerns, id];
    saveToFirestoreProfile(updated);
  };

  const handleSelectAll = () => {
    if (!onSetConcerns) return;
    triggerSuccessHaptic();
    const allIds = SKIN_CONCERNS.map((c) => c.id);
    onSetConcerns(allIds);
    saveToFirestoreProfile(allIds);
  };

  const handleClearAll = () => {
    if (!onSetConcerns) return;
    triggerSelectionHaptic();
    onSetConcerns([]);
    saveToFirestoreProfile([]);
  };

  return (
    <div className="space-y-4">
      {/* Search & Statistics Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center font-extrabold">
              {selectedConcerns.length}
            </span>
            <span>مشاكل محددة</span>
            {showSaveIndicator && lastSavedTime && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mr-2">
                <CloudCheck className="w-3 h-3 inline" />
                {lastSavedTime}
              </span>
            )}
          </div>

          {onSetConcerns && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
                تحديد الكل
              </button>
              {selectedConcerns.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  <RotateCcw className="w-3 h-3 text-rose-500" />
                  مسح
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search Input with Integrated Voice Dictation Button */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحثي عن مشكلة أو استخدمي الإملاء الصوتي 🎤..."
            className="pr-9 pl-12 rounded-2xl bg-card border-border text-xs focus-visible:ring-primary h-11"
          />

          {/* Voice Input Trigger Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all flex items-center justify-center",
              isListening
                ? "bg-rose-500 text-white mic-listening-pulse shadow-md"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            title="إملاء صوتي لمشاكل البشرة"
            aria-label="إملاء صوتي"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* Voice Dictation 'Listening' Soundwave Container */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-card border-2 border-primary/40 rounded-2xl p-4 shadow-md space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 grid place-items-center mic-listening-pulse shrink-0">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground">جاري الاستماع لصوتكِ الأن...</h5>
                    <p className="text-[10px] text-muted-foreground">تحدثي بعفوية عن مشاكل بشرتكِ (مثل: عندي جفاف وهالات)</p>
                  </div>
                </div>

                {/* Soundwave Bar Animation Pattern */}
                <div className="flex items-center gap-1 h-7 px-2 bg-muted/60 rounded-xl">
                  <div className="soundwave-bar" />
                  <div className="soundwave-bar" />
                  <div className="soundwave-bar" />
                  <div className="soundwave-bar" />
                  <div className="soundwave-bar" />
                  <div className="soundwave-bar" />
                  <div className="soundwave-bar" />
                </div>
              </div>

              {/* Realtime voice text display or prompt */}
              <div className="p-2.5 bg-muted/50 rounded-xl border border-border/80 text-xs font-medium text-foreground min-h-[38px] flex items-center justify-between">
                <span>{voiceText || "أنا أستمع... ابدئي بالحديث..."}</span>
                <button
                  type="button"
                  onClick={() => handlePresetVoiceSample("عندي جفاف شديد وهالات سوداء حول العين")}
                  className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary font-bold px-2 py-1 rounded-lg shrink-0 mr-2"
                >
                  تجربة إملاء سريعة ✦
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Dictation 'Typing' Animation Banner */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-primary/10 border border-primary/30 rounded-2xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-spin" />
                <span className="text-xs font-bold text-primary">
                  جاري تحويل صوتكِ إلى كتابة واستخراج مشاكل البشرة...
                </span>
              </div>

              {/* Typing Dots CSS Animation Pattern */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-card rounded-xl border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-primary typing-dot" />
                <span className="w-2 h-2 rounded-full bg-primary typing-dot" />
                <span className="w-2 h-2 rounded-full bg-primary typing-dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Feedback Toast / Notification */}
        {voiceFeedback && !isListening && !isTyping && (
          <div className="text-[11px] font-semibold text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span>{voiceFeedback}</span>
            <button
              type="button"
              onClick={() => setVoiceFeedback(null)}
              className="text-muted-foreground hover:text-foreground text-[10px]"
            >
              تجاهل
            </button>
          </div>
        )}

        {/* Category Pills Slider */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isCatActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat);
                  triggerSelectionHaptic();
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                  isCatActive
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-Select Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <AnimatePresence mode="popLayout">
          {filteredConcerns.map((c) => {
            const isSelected = selectedConcerns.includes(c.id);
            return (
              <motion.button
                key={c.id}
                layout
                type="button"
                onClick={() => handleToggle(c.id)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between group overflow-hidden cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 bg-card hover:bg-muted/40"
                )}
              >
                {/* Header with Emoji, Title & Selected Badge */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl shrink-0 p-1 rounded-xl bg-muted/60 grid place-items-center">
                      {c.emoji}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-foreground leading-tight">
                        {c.label}
                      </h4>
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 mt-0.5 border-0 font-normal bg-muted text-muted-foreground"
                      >
                        {c.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Animated Checkbox indicator */}
                  <div className="relative shrink-0 pt-0.5">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full border-2 grid place-items-center transition-all duration-200",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground shadow-xs"
                          : "border-border group-hover:border-primary/50"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 450, damping: 22 }}
                        >
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                  {c.desc}
                </p>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredConcerns.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-muted/30 border border-dashed border-border text-muted-foreground space-y-2">
          <p className="text-xs font-semibold">لم نجد أي نتيجة تطابق خياركِ</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("الكل");
            }}
            className="text-xs text-primary font-bold underline"
          >
            إعادة إظهار الكل
          </button>
        </div>
      )}
    </div>
  );
}

