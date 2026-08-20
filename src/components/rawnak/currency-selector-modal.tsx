"use client";

import { useState } from "react";
import { Globe, Check, Coins, ChevronDown, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { SUPPORTED_CURRENCIES, CURRENCY_MAP, CurrencyConfig } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CurrencySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CurrencySelectorModal({ open, onOpenChange }: CurrencySelectorModalProps) {
  const { selectedCurrency, selectedCountry, setSelectedCurrency, setSelectedCountry } = useAppStore();

  const currentConfig = CURRENCY_MAP[selectedCurrency] || SUPPORTED_CURRENCIES[0];

  const handleSelect = (currency: CurrencyConfig) => {
    setSelectedCurrency(currency.code);
    setSelectedCountry(currency.countryAr);
    toast.success(`تم تغيير العملة والدولة إلى ${currency.nameAr} (${currency.symbol}) ✦`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-5 border-border bg-card dir-rtl shadow-2xl" dir="rtl">
        <DialogHeader className="text-right space-y-1.5 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-primary/10 border border-primary/30 text-primary grid place-items-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                تحديد الدولة والعملة
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none">
                  تحديث تلقائي
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                اختر عملتكِ المفضلة لتحويل أسعار جميع المنتجات والتوصيات فورياً
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Currency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto py-2 pr-1 no-scrollbar">
          {SUPPORTED_CURRENCIES.map((curr) => {
            const isSelected = selectedCurrency === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => handleSelect(curr)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-2xl border text-right transition-all interactive-btn",
                  isSelected
                    ? "bg-primary/10 border-primary text-primary shadow-xs"
                    : "bg-muted/30 border-border/70 text-foreground hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl shrink-0 leading-none">{curr.flag}</span>
                  <div>
                    <span className="font-extrabold text-xs block text-foreground">
                      {curr.countryAr}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      {curr.nameAr} ({curr.symbol})
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded-md">
                    {curr.code}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-start gap-2 text-xs">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            العملة الحالية المختارة هي <strong className="text-foreground">{currentConfig.nameAr} ({currentConfig.symbol})</strong>. ستحول أسعار مستحضرات التجميل والتوصيات في الخزانة والترشيحات بالكامل بناءً عليها.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact Pill Badge trigger for top bars / product headers
 */
export function CurrencySelectorTrigger() {
  const [modalOpen, setModalOpen] = useState(false);
  const { selectedCurrency } = useAppStore();
  const config = CURRENCY_MAP[selectedCurrency] || SUPPORTED_CURRENCIES[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/80 border border-border/80 hover:bg-muted text-foreground text-xs font-bold transition-all shadow-2xs interactive-btn"
        title="تغيير العملة والدولة"
      >
        <span className="text-sm leading-none">{config.flag}</span>
        <span>{config.symbol}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      <CurrencySelectorModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
