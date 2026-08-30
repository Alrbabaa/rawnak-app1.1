import { randomUUID } from "node:crypto";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Uploads a base64 data URL (what the client already produces via
 * canvas.toDataURL() for skin-analysis/cabinet photos) to Firebase Storage,
 * returns a stable tokenized Firebase download URL. The token lives in the
 * object's metadata, so this URL does not expire and the user's photo does
 * not need bucket-level public-read access.
 */
export async function uploadBase64Image(
  uid: string,
  folder: string,
  id: string,
  dataUrl: string
): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL");
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";

  const bucket = adminStorage.bucket();
  const path = `users/${uid}/${folder}/${id}.${ext}`;
  const file = bucket.file(path);

  const downloadToken = randomUUID();
  await file.save(Buffer.from(base64, "base64"), {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;
}

/**
 * Uploads a base64 data URL for admin-managed public content (e.g. product
 * photos in the catalog) that isn't tied to a specific user's folder.
 * Same public-read simplification as `uploadBase64Image` — these are
 * storefront product photos, not private documents.
 */
export async function uploadPublicImage(
  folder: string,
  id: string,
  dataUrl: string
): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL");
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";

  const bucket = adminStorage.bucket();
  const path = `public/${folder}/${id}-${Date.now()}.${ext}`;
  const file = bucket.file(path);

  await file.save(Buffer.from(base64, "base64"), {
    metadata: { contentType: mimeType },
  });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

/** Best-effort delete — used when a cabinet product or analysis is removed. */
export async function deleteStorageImage(uid: string, folder: string, id: string): Promise<void> {
  try {
    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/${folder}/${id}.` });
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch {
    // non-fatal
  }
}
