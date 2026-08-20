import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export { ImpactStyle };

/**
 * Triggers subtle vibration feedback for user interactions.
 * Safe for both native (Capacitor iOS/Android) and web browsers.
 */

export async function triggerSuccessHaptic(): Promise<void> {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([40, 60, 40]);
    }
  }
}

export async function triggerImpactHaptic(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
  try {
    await Haptics.impact({ style });
  } catch {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(25);
    }
  }
}

export async function triggerSelectionHaptic(): Promise<void> {
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(15);
    }
  }
}
