"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { BRAND } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Mail,
  Globe,
  Instagram,
  Twitter,
  Linkedin,
  Shield,
  FileText,
  Sparkles,
  Target,
  Eye,
  Building2,
  Heart,
  Handshake,
  ExternalLink,
} from "lucide-react";
import { AppFooter } from "../app-footer";

interface Partner {
  id: string;
  name: string;
  type: string;
  description: string | null;
  websiteUrl: string | null;
}

const PARTNER_TYPE_LABEL: Record<string, string> = {
  partner: "شريك",
  sponsor: "راعي",
  brand: "علامة تجارية",
  affiliate_store: "متجر شريك",
  collaboration: "تعاون",
};

export function AboutScreen() {
  const { setView, goBack } = useAppStore();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [activeSection, setActiveSection] = useState<
    "about" | "privacy" | "terms"
  >("about");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/partners");
        const data = await res.json();
        if (active && res.ok) setPartners(data.partners || []);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="py-3 space-y-5">
      <button
        onClick={() => { if (!goBack()) setView("home"); }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        رجوع
      </button>

      {/* Hero with Rawnak + Artistic Minds branding */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl rawnak-gradient p-6 text-center rawnak-shadow"
      >
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[oklch(0.72_0.085_45/0.3)] blur-2xl" />
        <div className="relative z-10 flex flex-col items-center">
          <img
            src={BRAND.appLogo}
            alt={BRAND.appName}
            className="w-20 h-20 rounded-2xl object-cover mb-3 rawnak-glow"
          />
          <h1 className="text-3xl font-extrabold rawnak-gold-text mb-1">
            {BRAND.appName}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">{BRAND.tagline}</p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 backdrop-blur">
            <img
              src={BRAND.parentCompany.logo}
              alt={BRAND.parentCompany.name}
              className="w-5 h-5 rounded object-cover"
            />
            <span className="text-xs font-semibold text-foreground">
              {BRAND.parentCompany.taglineAr}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Section tabs */}
      <div className="flex gap-1.5 p-1 rounded-2xl bg-muted/60">
        {[
          { id: "about" as const, label: "عن رَونق", icon: Sparkles },
          { id: "privacy" as const, label: "الخصوصية", icon: Shield },
          { id: "terms" as const, label: "الشروط", icon: FileText },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeSection === s.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* About section */}
      {activeSection === "about" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Description */}
          <Card className="p-5 rounded-3xl border-border">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              ما هي رَونق؟
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              رَونق هي مساعدتكِ الذكية للجمال والعناية بالبشرة، تجمع بين الذكاء
              الاصطناعي والرؤية الجمالية لتقدّم لكِ تجربة فاخرة وشخصية. من تحليل
              البشرة بالكاميرا، إلى روتين مخصّص، ومحادثة مع خبيرة جمال متاحة
              على مدار الساعة — رَونق تفهم بشرتكِ وأهدافكِ وتواكب رحلتكِ نحو
              الإشراق.
            </p>
          </Card>

          {/* Vision & Mission */}
          <div className="grid grid-cols-1 gap-3">
            <Card className="p-5 rounded-3xl border-border">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                الرؤية
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {BRAND.vision}
              </p>
            </Card>
            <Card className="p-5 rounded-3xl border-border">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                الرسالة
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {BRAND.mission}
              </p>
            </Card>
          </div>

          {/* Parent company */}
          <Card className="p-5 rounded-3xl border-border">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              الشركة الأم
            </h3>
            <div className="flex items-center gap-4 mb-3">
              <img
                src={BRAND.parentCompany.logo}
                alt={BRAND.parentCompany.name}
                className="w-16 h-16 rounded-2xl object-cover rawnak-glow"
              />
              <div>
                <p className="font-extrabold text-lg">{BRAND.parentCompany.name}</p>
                <p className="text-xs text-primary font-semibold">
                  {BRAND.parentCompany.taglineAr}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {BRAND.parentCompany.description}
            </p>

            {/* Website + social */}
            <div className="flex flex-wrap gap-2">
              <a
                href={BRAND.parentCompany.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-semibold hover:bg-muted/70 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                {BRAND.parentCompany.websitePlaceholder}
              </a>
              <a
                href={BRAND.parentCompany.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 grid place-items-center rounded-full bg-muted hover:bg-muted/70 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={BRAND.parentCompany.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 grid place-items-center rounded-full bg-muted hover:bg-muted/70 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href={BRAND.parentCompany.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 grid place-items-center rounded-full bg-muted hover:bg-muted/70 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </Card>

          {/* Contact */}
          <Card className="p-5 rounded-3xl border-border">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              تواصلي معنا
            </h3>
            <a
              href={`mailto:${BRAND.contact.email}`}
              className="text-sm text-primary hover:underline"
              dir="ltr"
            >
              {BRAND.contact.email}
            </a>
          </Card>

          {/* Partners */}
          <Card className="p-5 rounded-3xl border-border">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" />
              شركاء النجاح
            </h3>
            {partners.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                قريبًا شراكات جديدة ✦
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {partners.map((p) => (
                  <a
                    key={p.id}
                    href={p.websiteUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-center"
                  >
                    <p className="font-bold text-sm">{p.name}</p>
                    {p.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {p.description}
                      </p>
                    )}
                    <Badge
                      variant="outline"
                      className="mt-1.5 rounded-full text-[9px]"
                    >
                      {PARTNER_TYPE_LABEL[p.type] || p.type}
                    </Badge>
                  </a>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
              هيكل مرن يدعم الشركاء والرعاة والعلامات التجارية والمتاجر الشريكة
            </p>
          </Card>
        </motion.div>
      )}

      {/* Privacy Policy */}
      {activeSection === "privacy" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-5 rounded-3xl border-primary/30 bg-primary/5 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl rawnak-rose-gradient grid place-items-center shrink-0">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-foreground">
                  صوركِ لا تُستخدم للتسويق أو الإعلانات أبدًا
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  صور تحليل بشرتكِ تُعالَج فقط لغرض تقديم التحليل والتوصيات
                  لكِ، عبر خوادمنا ومزوّد خدمة الذكاء الاصطناعي الذي يقوم
                  بالتحليل نيابةً عنّا. لا نبيعها ولا نمنح شركات تسويق أو
                  معلنين وصولًا إليها.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 rounded-3xl border-border">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              سياسة الخصوصية
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                رَونق تلتزم بحماية خصوصيتكِ. تجمع هذه السياسة كيفية تعاملنا مع
                بياناتكِ الشخصية عند استخدام التطبيق.
              </p>
              <h4 className="font-bold text-foreground">البيانات التي نجمعها</h4>
              <p>
                • معلومات الملف: الاسم، البريد، العمر، نوع ولون البشرة، المشاكل
                والأهداف الجمالية.
              </p>
              <p>
                • بيانات الاستخدام: التحليلات، خزانة المنتجات، المحادثات مع
                المساعد، الفيديوهات المفضّلة.
              </p>
              <p>• صور البشرة لتحليلها (تُحفظ في قاعدة البيانات).</p>

              <h4 className="font-bold text-foreground">كيف نستخدم بياناتكِ</h4>
              <p>
                • تخصيص التجربة وتقديم توصيات جمالية شخصية. • تحسين خدمات الذكاء
                الاصطناعي. • إشعارات الروتين والنصائح. • تحليلات إجمالية لتحسين
                التطبيق.
              </p>

              <h4 className="font-bold text-foreground">حماية البيانات</h4>
              <p>
                نستخدم إجراءات أمنية مناسبة لحماية بياناتكِ. نعتمد على Firebase
                (خدمة من Google) لتخزين الحساب والبيانات، ومزوّد خدمة الذكاء
                الاصطناعي لمعالجة صور التحليل — وهذان الطرفان ملزمان تعاقديًا
                بحماية بياناتكِ ولا نبيعها لأي جهة أخرى.
              </p>

              <h4 className="font-bold text-foreground">حقوقكِ</h4>
              <p>
                يمكنكِ الوصول إلى بياناتكِ أو تعديلها في أي وقت من ملفكِ
                الشخصي، أو حذف حسابكِ وجميع بياناتكِ نهائياً من تبويب «الحساب»
                ← «حذف الحساب نهائياً» — أو عبر صفحة حذف الحساب على الويب لمن
                لا يستطيع الوصول إلى التطبيق.
              </p>

              <p>
                للاطّلاع على النسخة الكاملة من سياسة الخصوصية والشروط والأحكام،
                يمكنكِ زيارة{" "}
                <Link href="/privacy" className="text-primary underline font-bold">
                  rawnakapp.com/privacy
                </Link>{" "}
                و{" "}
                <Link href="/terms" className="text-primary underline font-bold">
                  rawnakapp.com/terms
                </Link>.
              </p>

              <p className="text-xs text-muted-foreground/60 pt-2 border-t border-border">
                آخر تحديث: أغسطس ٢٠٢٦ · {BRAND.legal.copyright}
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Terms of Service */}
      {activeSection === "terms" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-5 rounded-3xl border-border">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              الشروط والأحكام
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                باستخدامكِ لتطبيق رَونق، فإنكِ توافقين على الشروط التالية:
              </p>
              <h4 className="font-bold text-foreground">١. الخدمة</h4>
              <p>
                رَونق منصة جمالية تعتمد على الذكاء الاصطناعي. النصائح والتحليلات
                هي لأغراض معلوماتية ولا تُغني عن استشارة الطبيب المختص.
              </p>
              <h4 className="font-bold text-foreground">٢. الحساب</h4>
              <p>
                أنتِ مسؤولة عن صحة المعلومات المقدّمة وحفظ بيانات حسابكِ.
              </p>
              <h4 className="font-bold text-foreground">٣. المحتوى</h4>
              <p>
                المنتجات والفيديوهات والمقالات معروضة لأغراض تعليمية. روابط
                الشراء قد تكون روابط تسويق بالعمولة.
              </p>
              <h4 className="font-bold text-foreground">٤. الملكية الفكرية</h4>
              <p>
                جميع العلامات التجارية والمحتوى مملوكة لـ Artistic Minds ومحمية
                بقوانين الملكية الفكرية.
              </p>
              <h4 className="font-bold text-foreground">٥. المسؤولية</h4>
              <p>
                لا تتحمل الشركة مسؤولية أي ضرر ناتج عن استخدام التطبيق أو
                المنتجات الموصى بها.
              </p>

              <p className="text-xs text-muted-foreground/60 pt-2 border-t border-border">
                آخر تحديث: يونيو ٢٠٢٦ · {BRAND.legal.copyright}
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      <AppFooter />
    </div>
  );
}
