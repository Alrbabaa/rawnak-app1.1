import type { Metadata } from "next";
import Image from "next/image";
import { Check, Clock3, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import styles from "./delete-account.module.css";

const DELETE_EMAIL = "rawnakapp@gmail.com";
const EMAIL_SUBJECT = "طلب حذف حساب";

export const metadata: Metadata = {
  title: "طلب حذف الحساب - تطبيق رونق",
  description: "تعليمات طلب حذف حساب تطبيق رونق وجميع البيانات الشخصية المرتبطة به نهائيًا خلال 48 ساعة من التحقق من الطلب.",
  alternates: { canonical: "/delete-account" },
};

const steps = [
  { title: "أرسلي طلب الحذف", description: <>أرسلي رسالة إلكترونية إلى <bdi>{DELETE_EMAIL}</bdi>.</> },
  { title: "اكتبي عنوان الرسالة", description: <>يجب أن يكون عنوان الرسالة: <strong>«{EMAIL_SUBJECT}»</strong>.</> },
  { title: "أضيفي بريدكِ المسجّل", description: "اذكري داخل الرسالة عنوان البريد الإلكتروني الذي استخدمتِه للتسجيل في تطبيق رونق، حتى نتمكن من التحقق من ملكية الحساب." },
];

export default function DeleteAccountPage() {
  const mailto = `mailto:${DELETE_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`;
  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shell}>
        <nav className={styles.brand} aria-label="رونق">
          <Image src="/rawnak-icon.jpg" alt="شعار تطبيق رونق" width={48} height={48} className={styles.logo} priority />
          <div><span className={styles.brandName}>رَونق</span><span className={styles.brandTag}>جمالكِ، بلمسة أذكى</span></div>
        </nav>

        <header className={styles.hero}>
          <span className={styles.eyebrow}><ShieldCheck size={16} aria-hidden="true" />الخصوصية وحقوق المستخدم</span>
          <h1>طلب حذف الحساب - تطبيق رونق</h1>
          <p>يمكنكِ طلب حذف حسابكِ وجميع البيانات المرتبطة به نهائيًا باتباع الخطوات البسيطة أدناه.</p>
        </header>

        <section className={styles.card} aria-labelledby="steps-heading">
          <div className={styles.sectionHeading}>
            <div className={styles.headingIcon}><Mail size={21} aria-hidden="true" /></div>
            <div><p className={styles.kicker}>خطوات الطلب</p><h2 id="steps-heading">كيفية طلب حذف حسابكِ</h2></div>
          </div>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
          <a className={styles.emailButton} href={mailto}><Mail size={19} aria-hidden="true" />إرسال طلب حذف الحساب</a>
          <p className={styles.emailNote}>البريد المخصص للطلب: <bdi>{DELETE_EMAIL}</bdi></p>
        </section>

        <section className={`${styles.card} ${styles.privacyCard}`} aria-labelledby="privacy-heading">
          <div className={styles.privacyIcon}><ShieldCheck size={27} aria-hidden="true" /></div>
          <div>
            <p className={styles.kicker}>التزامنا بخصوصيتكِ</p>
            <h2 id="privacy-heading">حذف نهائي وآمن للبيانات</h2>
            <p>بعد التحقق من صحة الطلب وملكية الحساب، سيتم حذف جميع بياناتكِ الشخصية ومعلومات ملفكِ الشخصي وكافة البيانات المرتبطة بحسابكِ نهائيًا من خوادمنا خلال <strong>48 ساعة</strong>. لا يمكن استعادة الحساب أو البيانات بعد إتمام الحذف.</p>
            <div className={styles.promise}>
              <span><Check size={16} /> البيانات الشخصية</span><span><Check size={16} /> معلومات الملف الشخصي</span><span><Check size={16} /> البيانات المرتبطة بالحساب</span>
            </div>
          </div>
          <div className={styles.timeBadge}><Clock3 size={20} aria-hidden="true" /><span><strong>48</strong> ساعة</span></div>
        </section>

        <footer className={styles.footer}>
          <p>هل تحتاجين إلى مساعدة؟ تواصلي معنا</p>
          <div className={styles.contactLinks}>
            <a href={`mailto:${DELETE_EMAIL}`}><bdi>{DELETE_EMAIL}</bdi></a><span aria-hidden="true">•</span>
            <a href="mailto:artisticmindsa.r@gmail.com"><bdi>artisticmindsa.r@gmail.com</bdi></a><span aria-hidden="true">•</span>
            <a href="https://artisticmindsa.com" target="_blank" rel="noreferrer"><bdi>artisticmindsa.com</bdi> <ExternalLink size={13} aria-hidden="true" /></a>
          </div>
          <small>© 2026 رونق — Artistic Minds. جميع الحقوق محفوظة.</small>
        </footer>
      </div>
    </main>
  );
}
