import { adminDb, adminMessaging } from "@/lib/firebase/admin";

/**
 * Sends a web push notification to a user via FCM, if (and only if) they
 * have a registered token (see /api/notifications/register-token). This
 * is intentionally NOT the only way a user finds out about something —
 * the existing users/{uid}/notifications Firestore collection (the
 * in-app inbox, see /api/notifications) is still written unconditionally
 * regardless of push. This function only adds a device push on top of
 * that, exactly like the local-notifications reminders already do for
 * on-device scheduling — additive, never a replacement.
 *
 * Best-effort by design: a missing token, a denied permission, or a
 * send failure must never break whatever action triggered the
 * notification (an achievement unlock, etc.) — this function never
 * throws.
 */
export async function sendPushToUser(
  uid: string,
  payload: { title: string; body: string }
): Promise<void> {
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const token = userDoc.data()?.fcmToken as string | undefined;
    if (!token) return; // No push registered for this user — silent no-op.

    await adminMessaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      webpush: {
        fcmOptions: { link: "/" },
      },
    });
  } catch (err: unknown) {
    // A stale/revoked token (uninstalled, permission revoked, browser data
    // cleared) is an EXPECTED, routine failure mode — clear it so future
    // sends don't keep retrying a dead token. Any other error is logged
    // but still swallowed, per this function's best-effort contract.
    const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
    if (code === "messaging/registration-token-not-registered") {
      await adminDb.collection("users").doc(uid).update({ fcmToken: null }).catch(() => {});
    } else {
      console.error("[sendPushToUser] error:", err instanceof Error ? err.message : err);
    }
  }
}
