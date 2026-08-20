"use client";

import { useAppStore, type View } from "@/lib/store";
import { Sparkles, Grid3x3, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared by picks-screen.tsx ("الكل" — the curated catalog),
 * products-screen.tsx ("لأجلكِ" — AI picks based on your skin profile),
 * and style-studio-screen.tsx ("الإطلالة" — trends, color palettes, and
 * the outfit coordinator). Three different sources under the hood (a
 * static/CMS catalog, a live /api/recommendations call, and editorial
 * style content) — merging their fetch logic into one component would be
 * a much riskier change for the same user-facing result. This strip is
 * what makes them read as one shopping section with tabs instead of
 * unrelated screens, which was the actual complaint (not the data model
 * underneath).
 */
export function ProductsTabHeader() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  const tabs: { view: View; label: string; icon: typeof Sparkles }[] = [
    { view: "products", label: "لأجلكِ", icon: Sparkles },
    { view: "picks", label: "الكل", icon: Grid3x3 },
    { view: "style", label: "الإطلالة", icon: Wand2 },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border">
      {tabs.map((tab) => {
        const active = view === tab.view;
        const Icon = tab.icon;
        return (
          <button
            key={tab.view}
            onClick={() => setView(tab.view)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all",
              active ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
