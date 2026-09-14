"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceInputResult {
  // True only once the browser actually exposes SpeechRecognition — same
  // "check the real device, don't assume" approach as use-speech.ts.
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

// Not in the standard DOM lib typings yet — declared narrowly here rather
// than pulling in a whole ambient-types package for one API.
interface MinimalSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

/**
 * Voice input for the beauty-expert chat — VIP perk (gated by the caller,
 * not here, so this hook stays a plain capability wrapper). Wraps the Web
 * Speech API's SpeechRecognition for Arabic dictation; transcribed text is
 * handed back via onResult so the caller decides whether to append it to
 * an existing draft or replace it.
 */
function getSpeechRecognitionCtor(): (new () => MinimalSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: new () => MinimalSpeechRecognition }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => MinimalSpeechRecognition }).webkitSpeechRecognition ||
    null
  );
}

export function useVoiceInput(onResult: (transcript: string) => void): UseVoiceInputResult {
  // Lazy-initialized once from the real device capability — no setState
  // call needed later just to flip this on.
  const [supported] = useState(() => !!getSpeechRecognitionCtor());
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);

  // Keeping the callback ref current belongs in an effect, not render —
  // a fresh `onResult` closure is created on every parent render (it
  // closes over `input`/`setInput`), so recreating the whole
  // SpeechRecognition instance to match would tear down an in-progress
  // listening session. This keeps one long-lived instance while always
  // calling the latest callback.
  useEffect(() => {
    onResultRef.current = onResult;
  });

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript;
      if (transcript) onResultRef.current(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if already running — safe to ignore, onend resets state
    }
  }, [listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
