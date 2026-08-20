/** Arabic relative time, e.g. "قبل 5 دقائق" / "قبل يومين" / "قبل أسبوع". */
export function formatDistanceToNow(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "الآن";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `قبل ${minutes} ${minutes === 1 ? "دقيقة" : "دقائق"}`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`;

  const days = Math.round(hours / 24);
  if (days < 7) return `قبل ${days} ${days === 1 ? "يوم" : "أيام"}`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return `قبل ${weeks === 1 ? "أسبوع" : `${weeks} أسابيع`}`;

  const months = Math.round(days / 30);
  return `قبل ${months === 1 ? "شهر" : `${months} أشهر`}`;
}
