/**
 * Generates the PWA icons from one SVG source, using the local Chromium
 * (no network, no image libraries). Run: node scripts/generate-icons.mjs
 *
 * Variants (why several):
 *  - icon.svg              favicon (vector, rounded square)
 *  - icon-192/512.png      "any" purpose: rounded square, transparent corners
 *  - icon-maskable-512.png Android adaptive icon: full-bleed background, glyph
 *                          inside the 80% "safe zone" (the OS crops a circle/squircle)
 *  - apple-touch-icon.png  iOS: 180px, full-bleed, no transparency (iOS rounds it)
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BRAND = "#0f8a8a"; // ≈ oklch(0.55 0.1 190) — the --brand token (light theme)
const FG = "#ffffff";

/** glyph = fraction of the canvas the two circles occupy; radius = corner radius fraction */
function svg({ size, glyph, radius }) {
  const g = size * glyph; // glyph box size; original glyph lives in a 24×24 box spanning x 3..21
  const s = g / 18;
  const ox = (size - 24 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND}"/>
<g transform="translate(${ox} ${ox}) scale(${s})" fill="none" stroke="${FG}" stroke-width="2.2">
<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></g></svg>`;
}

const variants = [
  { file: "icon-192.png", size: 192, glyph: 0.6, radius: 0.22 },
  { file: "icon-512.png", size: 512, glyph: 0.6, radius: 0.22 },
  { file: "icon-maskable-512.png", size: 512, glyph: 0.46, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, glyph: 0.56, radius: 0 },
];

writeFileSync("public/icons/icon.svg", svg({ size: 64, glyph: 0.66, radius: 0.22 }));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const v of variants) {
  await page.setViewportSize({ width: v.size, height: v.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(v)}</body></html>`);
  await page.locator("svg").screenshot({ path: `public/icons/${v.file}`, omitBackground: true });
  console.log("✓", v.file);
}
await browser.close();
