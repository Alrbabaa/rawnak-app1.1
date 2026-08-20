"use client";

import { useAppStore } from "@/lib/store";
import { BRAND } from "@/lib/brand";
import { Building2, FileText, Shield, Heart } from "lucide-react";

/**
 * Consistent app footer — shows parent company branding, version, and legal links.
 * Appears on the profile screen and About page.
 */
export function AppFooter() {
  const setView = useAppStore((s) => s.setView);

  return (
    <footer className="mt-8 pt-6 border-t border-border">
      {/* Parent company branding */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <img
            src={BRAND.parentCompany.logo}
            alt={BRAND.parentCompany.name}
            className="w-8 h-8 rounded-lg object-cover"
          />
          <div className="leading-tight">
            <p className="text-xs font-bold text-foreground">
              {BRAND.parentCompany.taglineAr}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {BRAND.parentCompany.name}
            </p>
          </div>
        </div>
      </div>

      {/* Legal links */}
      <div className="flex items-center justify-center gap-4 mb-3 text-xs">
        <button
          onClick={() => setView("about")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          عن رَونق
        </button>
        <button
          onClick={() => setView("about")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Shield className="w-3 h-3" />
          سياسة الخصوصية
        </button>
        <button
          onClick={() => setView("about")}
          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          الشروط
        </button>
      </div>

      {/* Copyright + version */}
      <div className="text-center space-y-1">
        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          {BRAND.legal.poweredByAr}
          <Heart className="w-2.5 h-2.5 text-primary fill-primary" />
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          {BRAND.legal.copyright}
        </p>
        <p className="text-[10px] text-muted-foreground/50">
          الإصدار {BRAND.version}
        </p>
      </div>
    </footer>
  );
}
