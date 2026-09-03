"use client";

// Portrait 9:16 — same story-format canvas as glow-card.ts, and the same
// hand-picked hex approximations of the app's oklch brand tokens (see that
// file's header comment for why hex instead of oklch here).
const WIDTH = 1080;
const HEIGHT = 1920;

const BG_TOP = "#241a1f";
const BG_BOTTOM = "#150f0d";
const GOLD_FROM = "#eac48a";
const GOLD_MID = "#d19a5a";
const GOLD_TO = "#f0d9a0";
const ROSE_FROM = "#e0847a";
const ROSE_TO = "#c76b82";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
    return null;
  }
}

/**
 * Renders a shareable "invite a friend" card — the peer-referral growth
 * loop's artifact. Just the code + a warm invitation, no personal skin
 * data (that's the glow card's job, see glow-card.ts).
 */
export async function generateInviteCard(referralCode: string, inviterName?: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  ctx.direction = "rtl";

  try {
    await Promise.all([
      document.fonts.load("800 90px Cairo"),
      document.fonts.load("700 50px Cairo"),
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

  const glow1 = ctx.createRadialGradient(WIDTH * 0.8, 300, 0, WIDTH * 0.8, 300, 560);
  glow1.addColorStop(0, "rgba(224,132,122,0.32)");
  glow1.addColorStop(1, "rgba(224,132,122,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow2 = ctx.createRadialGradient(WIDTH * 0.2, HEIGHT * 0.75, 0, WIDTH * 0.2, HEIGHT * 0.75, 600);
  glow2.addColorStop(0, "rgba(209,154,90,0.26)");
  glow2.addColorStop(1, "rgba(209,154,90,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark
  const logo = await loadImage("/logo.svg");
  const logoSize = 90;
  const logoY = 150;
  if (logo) {
    ctx.save();
    roundRect(ctx, WIDTH / 2 - logoSize / 2, logoY, logoSize, logoSize, 24);
    ctx.clip();
    ctx.drawImage(logo, WIDTH / 2 - logoSize / 2, logoY, logoSize, logoSize);
    ctx.restore();
  }
  const goldText = ctx.createLinearGradient(WIDTH / 2 - 140, 0, WIDTH / 2 + 140, 0);
  goldText.addColorStop(0, GOLD_FROM);
  goldText.addColorStop(0.5, GOLD_MID);
  goldText.addColorStop(1, GOLD_TO);
  centerText(ctx, "رَونق", WIDTH / 2, logoY + logoSize + 78, "800 56px Cairo, sans-serif", goldText);

  // Invitation headline
  const roseText = ctx.createLinearGradient(WIDTH / 2 - 320, 0, WIDTH / 2 + 320, 0);
  roseText.addColorStop(0, ROSE_FROM);
  roseText.addColorStop(1, ROSE_TO);
  const headline = inviterName ? `${inviterName} تدعوكِ لتجربة رَونق ✦` : "جرّبي رَونق معي ✦";
  wrapCenterText(ctx, headline, WIDTH / 2, 560, "700 58px Cairo, sans-serif", "#ffffff", WIDTH - 180, 74);

  centerText(
    ctx,
    "خبيرتكِ الشخصية بالذكاء الاصطناعي للجمال والعناية بالبشرة",
    WIDTH / 2,
    700,
    "500 34px Cairo, sans-serif",
    "rgba(255,255,255,0.72)"
  );

  // Code panel
  const panelW = 760;
  const panelH = 260;
  const panelX = WIDTH / 2 - panelW / 2;
  const panelY = 860;
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, 40);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(234,196,138,0.5)";
  ctx.stroke();
  ctx.restore();

  centerText(
    ctx,
    "كود دعوتكِ",
    WIDTH / 2,
    panelY + 70,
    "600 32px Cairo, sans-serif",
    "rgba(255,255,255,0.65)"
  );
  // Code itself is Latin/numeric — safe to render LTR regardless of the
  // canvas-wide RTL direction set above.
  ctx.direction = "ltr";
  centerText(ctx, referralCode, WIDTH / 2, panelY + 175, "800 90px Cairo, sans-serif", goldText);
  ctx.direction = "rtl";

  // What they get
  centerText(
    ctx,
    "سجّلي بالكود واحصلي على تجربة جمال مخصصة لكِ",
    WIDTH / 2,
    panelY + panelH + 100,
    "600 36px Cairo, sans-serif",
    "#ffffff"
  );

  // CTA footer
  centerText(ctx, "www.rawnakapp.com", WIDTH / 2, HEIGHT - 130, "500 34px Cairo, sans-serif", "rgba(255,255,255,0.6)");

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png", 0.95);
  });
}

/** Wraps `text` across up to 2 centered lines within `maxWidth`. Good enough
 * for a short headline — not a general-purpose text layout engine. */
function wrapCenterText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  font: string,
  fillStyle: string | CanvasGradient,
  maxWidth: number,
  lineHeight: number
) {
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const totalHeight = (lines.length - 1) * lineHeight;
  const firstY = startY - totalHeight / 2;
  lines.forEach((line, i) => {
    centerText(ctx, line, x, firstY + i * lineHeight, font, fillStyle);
  });
}
