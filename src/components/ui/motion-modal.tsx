"use client";

import * as React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  type?: "sheet" | "dialog";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  showCloseButton?: boolean;
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const sheetVariants: Variants = {
  hidden: { y: "100%", opacity: 0.6 },
  visible: {
    y: "0%",
    opacity: 1,
    transition: { type: "spring", damping: 32, stiffness: 340 },
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", damping: 26, stiffness: 350 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

export function MotionModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  type = "sheet",
  maxWidth = "md",
  className,
  showCloseButton = true,
}: MotionModalProps) {
  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-full",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal or Sheet Content */}
          <motion.div
            role="dialog"
            aria-modal="true"
            variants={type === "sheet" ? sheetVariants : dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "relative z-10 w-full bg-card border border-border shadow-2xl overflow-hidden flex flex-col",
              type === "sheet"
                ? "rounded-t-3xl sm:rounded-3xl max-h-[88vh]"
                : "rounded-3xl max-h-[85vh] my-auto",
              maxWidthClasses[maxWidth],
              className
            )}
          >
            {/* Grab handle for sheets on mobile */}
            {type === "sheet" && (
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-3 mb-1 shrink-0" />
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
                <div>
                  {typeof title === "string" ? (
                    <h3 className="font-extrabold text-base text-foreground">{title}</h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full grid place-items-center bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    aria-label="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="p-5 overflow-y-auto pretty-scroll flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
