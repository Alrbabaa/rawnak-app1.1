"use client";

import { toast } from "sonner";

export const QUOTA_EXHAUSTED_MESSAGE =
  "لقد استنفدتِ محاولتكِ المجانية لهذه الأداة اليوم. ستتجدد حصتكِ منتصف الليل، أو يمكنكِ الترقية الآن لتجربة غير محدودة!";

export function showQuotaNotice(
  resetAt: number | undefined,
  onUpgrade: () => void
): void {
  const resetText = resetAt
    ? new Date(resetAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })
    : "منتصف الليل";

  toast(QUOTA_EXHAUSTED_MESSAGE, {
    description: `التجديد القادم: ${resetText}`,
    action: { label: "الترقية إلى رونق برو", onClick: onUpgrade },
    duration: 9000,
  });
}
