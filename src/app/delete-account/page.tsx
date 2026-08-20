import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حذف الحساب | رَونق",
  description:
    "طلب حذف حساب رَونق وبياناته نهائياً — عبر التطبيق مباشرة أو بالتواصل مع فريق الدعم.",
  keywords: [
    "حذف حساب رَونق",
    "حذف بيانات رَونق",
    "Rawnak delete account",
    "Rawnak data deletion",
  ],
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 shrink-0 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-extrabold">
        {n}
      </div>
      <div>
        <p className="font-bold text-sm text-foreground mb-1">{title}</p>
        <p className="text-sm text-foreground/70 leading-7">{children}</p>
      </div>
    </div>
  );
}

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-12 sm:px-8">
        <header className="mb-8 border-b border-border pb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">حذف حسابكِ وبياناتكِ</h1>
          <p className="text-sm text-foreground/60">تطبيق رَونق (Rawnak) — Artistic Minds</p>
        </header>

        <p className="text-[15px] leading-8 text-foreground/80 mb-8">
          يمكنكِ حذف حسابكِ في رَونق وجميع البيانات المرتبطة به بشكل نهائي وغير قابل
          للتراجع، بإحدى الطريقتين التاليتين.
        </p>

        <section className="mb-10 space-y-5 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-extrabold text-base">الطريقة الأولى: من داخل التطبيق (الأسرع)</h2>
          <Step n={1} title="افتحي التطبيق وسجّلي الدخول">
            من الشاشة الرئيسية اضغطي على أيقونة الملف الشخصي.
          </Step>
          <Step n={2} title="اذهبي إلى تبويب «الحساب»">
            ضمن شاشة الملف الشخصي، اختاري تبويب «الحساب» من القائمة العلوية.
          </Step>
          <Step n={3} title="اضغطي «حذف الحساب نهائياً»">
            ثم أكّدي الحذف عند ظهور رسالة التأكيد. سيتم حذف حسابكِ فور التأكيد.
          </Step>
        </section>

        <section className="mb-10 space-y-3 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-extrabold text-base">الطريقة الثانية: طلب الحذف عبر البريد الإلكتروني</h2>
          <p className="text-sm text-foreground/70 leading-7">
            إن تعذّر عليكِ الوصول إلى التطبيق، أرسلي رسالة من عنوان البريد الإلكتروني
            المسجَّل في حسابكِ إلى{" "}
            <strong dir="ltr">support@rawnak.app</strong> بعنوان «طلب حذف حساب»،
            وسنقوم بحذف حسابكِ وبياناتكِ خلال 14 يوم عمل على الأكثر، ثم نُرسل لكِ
            تأكيداً بذلك.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="font-extrabold text-base mb-3">ما الذي يتم حذفه؟</h2>
          <ul className="list-disc pr-5 space-y-2 text-sm leading-7 text-foreground/80">
            <li>بيانات الحساب (الاسم، البريد الإلكتروني، الفئة العمرية).</li>
            <li>صور ونتائج تحليل البشرة، وصور مسح المنتجات.</li>
            <li>روتين العناية، سلاسل الإنجاز، والشارات.</li>
            <li>الاتصالات الاجتماعية (المتابعون، رفيقة التوهج/Buddy، الملف العام).</li>
            <li>سجل المحادثة مع المساعد الذكي.</li>
            <li>رموز الإشعارات المرتبطة بجهازكِ.</li>
          </ul>
          <p className="text-xs text-foreground/50 mt-4 leading-6">
            يُستثنى من الحذف ما قد يلزم الاحتفاظ به بموجب القانون (مثل سجلات
            المعاملات المالية لأغراض محاسبية أو ضريبية)، وأي اشتراك نشط عبر متجر
            Apple أو Google — يجب إلغاؤه بشكل منفصل من إعدادات حساب المتجر الخاص
            بكِ، لأن رَونق لا يتحكم بمدفوعات المتجر مباشرة.
          </p>
        </section>
      </div>
    </main>
  );
}
