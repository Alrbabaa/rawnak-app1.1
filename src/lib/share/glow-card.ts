"use client";

import { scoreLabel, glowCaption, scoreColorHex } from "@/lib/skin-score";

export interface GlowCardInput {
  overall: number;
  skinType: string;
  // Only drawn if the caller explicitly opts in (see shareCardIncludePhoto
  // in store.ts, defaults to false/privacy mode) — this function never
  // decides that on its own.
  imageData?: string | null;
}

// Portrait 9:16 — the native size for Instagram/Snapchat/WhatsApp Stories,
// the exact sharing surface this card is built for.
const WIDTH = 1080;
const HEIGHT = 1920;

// Hand-picked hex approximations of the app's oklch rose-gold tokens
// (globals.css .rawnak-gradient / .rawnak-rose-gradient / .rawnak-gold-text).
// Canvas 2D's fillStyle parser doesn't reliably resolve oklch() across every
// WebView engine this app runs in, so this card uses plain hex rather than
// reading the CSS tokens directly — keep these in rough sync if the brand
// palette changes.
const BG_TOP = "#241a1f";
const BG_BOTTOM = "#150f0d";
const PANEL_FROM = "#6b4a52";
const PANEL_TO = "#46312d";
const ROSE_FROM = "#e0847a";
const ROSE_TO = "#c76b82";
const GOLD_FROM = "#eac48a";
const GOLD_MID = "#d19a5a";
const GOLD_TO = "#f0d9a0";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws left-to-right-safe centered text (handles the RTL/number mixing
 * quirks of ctx.direction="rtl" by keeping each call to a single script). */
function centerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  fillStyle: string | CanvasGradient
) {
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  } catch {
    return null; // logo is decorative — a failed load shouldn't break the card
  }
}

/**
 * Renders a shareable "glow card" PNG for a skin analysis result — the
 * growth-loop artifact: no login wall, no face photo (privacy by design,
 * per the same review that recommended this feature), just the score,
 * skin type, and a branded invite back to the app.
 */
export async function generateGlowCard({ overall, skinType, imageData }: GlowCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  ctx.direction = "rtl";

  // Make sure Cairo is actually loaded before measuring/drawing text —
  // otherwise the first export after a cold load can silently fall back
  // to a system font.
  try {
    await Promise.all([
      document.fonts.load("800 100px Cairo"),
      document.fonts.load("700 44px Cairo"),
      document.fonts.load("600 36px Cairo"),
      document.fonts.load("500 30px Cairo"),
    ]);
    await document.fonts.ready;
  } catch {
    // Non-fatal — falls back to the system sans-serif.
  }

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Ambient glow blobs (soft radial washes instead of a blur filter, for
  // broad WebView compatibility)
  const glow1 = ctx.createRadialGradient(WIDTH * 0.85, 260, 0, WIDTH * 0.85, 260, 520);
  glow1.addColorStop(0, "rgba(224,132,122,0.35)");
  glow1.addColorStop(1, "rgba(224,132,122,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow2 = ctx.createRadialGradient(WIDTH * 0.15, HEIGHT * 0.82, 0, WIDTH * 0.15, HEIGHT * 0.82, 560);
  glow2.addColorStop(0, "rgba(209,154,90,0.28)");
  glow2.addColorStop(1, "rgba(209,154,90,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark
  const logo = await loadImage("/logo.svg");
  const logoSize = 84;
  const logoY = 130;
  if (logo) {
    ctx.save();
    roundRect(ctx, WIDTH / 2 - logoSize / 2, logoY, logoSize, logoSize, 22);
    ctx.clip();
    ctx.drawImage(logo, WIDTH / 2 - logoSize / 2, logoY, logoSize, logoSize);
    ctx.restore();
  }
  const goldText = ctx.createLinearGradient(WIDTH / 2 - 140, 0, WIDTH / 2 + 140, 0);
  goldText.addColorStop(0, GOLD_FROM);
  goldText.addColorStop(0.5, GOLD_MID);
  goldText.addColorStop(1, GOLD_TO);
  centerText(ctx, "رَونق", WIDTH / 2, logoY + logoSize + 74, "800 52px Cairo, sans-serif", goldText);

  // Score panel — slightly taller when a photo is present (ring + score
  // badge + pill stack taller than the plain empty-ring-with-number layout).
  const panelX = 90;
  const panelY = 330;
  const panelW = WIDTH - panelX * 2;
  const panelH = imageData ? 1000 : 900;
  const panel = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  panel.addColorStop(0, PANEL_FROM);
  panel.addColorStop(1, PANEL_TO);
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 56);
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.restore();

  centerText(
    ctx,
    "نتيجة بشرتها العامة",
    WIDTH / 2,
    panelY + 100,
    "600 34px Cairo, sans-serif",
    "rgba(255,255,255,0.75)"
  );

  // Score ring
  const ringCx = WIDTH / 2;
  const ringCy = panelY + 340;
  const ringR = 220;
  ctx.lineWidth = 34;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.stroke();

  const pct = Math.max(0, Math.min(100, overall)) / 100;
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.strokeStyle = scoreColorHex(overall);
  ctx.stroke();

  // Photo is opt-in (shareCardIncludePhoto in store.ts, off by default) —
  // this function just draws whatever it's given, the privacy decision
  // already happened before this was called. When present, it becomes the
  // ring's "portrait" and the number moves to a badge below instead of
  // sitting empty in the middle of the ring.
  const photo = imageData ? await loadImage(imageData) : null;
  if (photo) {
    const photoR = ringR - ctx.lineWidth / 2 - 6; // inset so it doesn't bleed under the ring stroke
    ctx.save();
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, photoR, 0, Math.PI * 2);
    ctx.clip();
    // Cover-fit the (likely non-square) photo into the circular clip.
    const scale = Math.max((photoR * 2) / photo.width, (photoR * 2) / photo.height);
    const drawW = photo.width * scale;
    const drawH = photo.height * scale;
    ctx.drawImage(photo, ringCx - drawW / 2, ringCy - drawH / 2, drawW, drawH);
    ctx.restore();

    const scoreBadgeY = ringCy + ringR + 60;
    const scoreText = `${Math.round(overall)}/100`;
    ctx.font = "800 44px Cairo, sans-serif";
    const badgeW = ctx.measureText(scoreText).width + 64;
    roundRect(ctx, ringCx - badgeW / 2, scoreBadgeY, badgeW, 74, 37);
    ctx.fillStyle = scoreColorHex(overall);
    ctx.fill();
    centerText(ctx, scoreText, ringCx, scoreBadgeY + 50, "800 40px Cairo, sans-serif", "#ffffff");
  } else {
    centerText(ctx, String(Math.round(overall)), ringCx, ringCy + 45, "800 150px Cairo, sans-serif", "#ffffff");
    centerText(ctx, "من 100", ringCx, ringCy + 100, "500 30px Cairo, sans-serif", "rgba(255,255,255,0.65)");
  }

  // Score label pill
  const label = scoreLabel(overall);
  ctx.font = "700 34px Cairo, sans-serif";
  const labelW = ctx.measureText(label).width + 70;
  const pillY = photo ? ringCy + ringR + 150 : ringCy + ringR + 55;
  roundRect(ctx, ringCx - labelW / 2, pillY, labelW, 68, 34);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();
  centerText(ctx, label, ringCx, pillY + 46, "700 34px Cairo, sans-serif", "#ffffff");

  // Skin type
  centerText(
    ctx,
    `نوع بشرتها: ${skinType}`,
    ringCx,
    pillY + 140,
    "600 34px Cairo, sans-serif",
    "rgba(255,255,255,0.85)"
  );

  // Caption
  const roseText = ctx.createLinearGradient(ringCx - 260, 0, ringCx + 260, 0);
  roseText.addColorStop(0, ROSE_FROM);
  roseText.addColorStop(1, ROSE_TO);
  centerText(ctx, glowCaption(overall), ringCx, pillY + 230, "700 42px Cairo, sans-serif", roseText);

  // CTA footer
  centerText(
    ctx,
    "جرّبي تحليل بشرتكِ المجاني",
    WIDTH / 2,
    HEIGHT - 170,
    "700 40px Cairo, sans-serif",
    "#ffffff"
  );
  centerText(ctx, "www.rawnakapp.com", WIDTH / 2, HEIGHT - 110, "500 32px Cairo, sans-serif", "rgba(255,255,255,0.6)");

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png", 0.95);
  });
}
