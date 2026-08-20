/** Maps common Firebase Auth error codes to Arabic messages matching the
 * app's existing tone. Falls back to a generic message for anything else. */
export function firebaseAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "يوجد حساب مسجّل بهذا البريد بالفعل. جرّبي تسجيل الدخول.";
    case "auth/invalid-email":
      return "بريد إلكتروني غير صالح";
    case "auth/weak-password":
      return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "البريد أو كلمة المرور غير صحيحة";
    case "auth/too-many-requests":
      return "محاولات كثيرة جدًا. حاولي لاحقًا.";
    case "auth/network-request-failed":
      return "تعذّر الاتصال بالخادم";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "تم إغلاق نافذة تسجيل الدخول";
    case "auth/account-exists-with-different-credential":
      return "يوجد حساب بهذا البريد مسجّل بطريقة دخول مختلفة. جرّبي تلك الطريقة بدلًا من ذلك.";
    case "auth/operation-not-allowed":
      return "طريقة تسجيل الدخول هذه غير مُفعّلة حاليًا";
    case "auth/missing-or-invalid-nonce":
      // Apple-specific — the identity token's replay-protection nonce
      // didn't match what Firebase sent. Almost always a stale/duplicate
      // sign-in attempt; retrying fixes it.
      return "حدث خطأ أثناء التحقق من Apple. حاولي مرة أخرى.";
    default:
      return "حدث خطأ ما. حاولي مرة أخرى.";
  }
}
