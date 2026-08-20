"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechResult {
  // True only once an actual Arabic voice was found on this device. Not a
  // platform check — many Android devices ship Google Text-to-Speech with
  // Arabic voices already installed, and iOS exposes Siri voices to
  // WKWebView too, so a hardcoded "native = unsupported" would be wrong as
  // often as it's right. This checks the real device instead of guessing.
  supported: boolean;
  speakingId: string | null;
  speak: (id: string, text: string) => void;
  stop: () => void;
}

/** Strips the markdown AI chat replies are formatted with (**bold**, `-`
 * bullets, headers) — read literally, "asterisk asterisk" makes for a much
 * worse listening experience than plain sentences. */
function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-•]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/**
 * Thin wrapper around window.speechSynthesis for the "listen" button on AI
 * chat replies. Deliberately per-message (speakingId), not a single global
 * boolean — only one message plays at a time (speak() cancels whatever was
 * playing first), and each message's button reflects whether *it* is the
 * one currently playing.
 */
export function useSpeech(): UseSpeechResult {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("ar")) || null;
      voiceRef.current = arabicVoice;
      setSupported(!!arabicVoice);
    };

    pickVoice();
    // Most browsers load the voice list asynchronously — it's often empty
    // on the very first call, and only populated once this fires.
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel(); // only one message plays at a time

      // Tapping the message that's already playing just stops it.
      if (speakingId === id) {
        setSpeakingId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current?.lang || "ar-SA";
      utterance.rate = 0.98;
      utterance.onstart = () => setSpeakingId(id);
      utterance.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
      utterance.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      window.speechSynthesis.speak(utterance);
    },
    [speakingId]
  );

  return { supported, speakingId, speak, stop };
}
