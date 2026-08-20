"use client";

import { useEffect, useState } from "react";

export interface WeatherNow {
  tempC: number;
  label: string; // Arabic label matching WEATHER_CONDITIONS ids where possible
  emoji: string;
}

type Status = "idle" | "loading" | "ready" | "denied" | "error";

/**
 * Real current weather via the browser's geolocation + Open-Meteo
 * (open-meteo.com — free, no API key, no signup). No fake/placeholder
 * values are ever returned: if location permission is denied or the
 * request fails, `weather` stays null and `status` reflects why, so the
 * UI can be honest about not knowing instead of showing a made-up reading.
 */
function codeToLabel(code: number): { label: string; emoji: string } {
  // WMO weather interpretation codes (open-meteo.com/en/docs)
  if (code === 0) return { label: "مشمس صافٍ", emoji: "☀️" };
  if (code <= 2) return { label: "مشمس جزئيًا", emoji: "🌤️" };
  if (code === 3) return { label: "غائم", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "ضبابي", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "رذاذ خفيف", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "ممطر", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "ثلجي", emoji: "❄️" };
  if (code >= 80 && code <= 82) return { label: "زخات مطر", emoji: "🌦️" };
  if (code >= 95) return { label: "عاصف رعدي", emoji: "⛈️" };
  return { label: "معتدل", emoji: "🌤️" };
}

export function useRealWeather() {
  const [status, setStatus] = useState<Status>("idle");
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      // One-shot feature-detection at mount — not a cascading-render concern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      return;
    }
    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("weather fetch failed");
          const data = await res.json();
          const temp = data?.current_weather?.temperature;
          const code = data?.current_weather?.weathercode;
          if (typeof temp !== "number" || typeof code !== "number") {
            throw new Error("unexpected weather payload");
          }
          const { label, emoji } = codeToLabel(code);
          setWeather({ tempC: Math.round(temp), label, emoji });
          setStatus("ready");
        } catch {
          setStatus("error");
        }
      },
      () => setStatus("denied"),
      { timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  }, []);

  return { status, weather };
}
