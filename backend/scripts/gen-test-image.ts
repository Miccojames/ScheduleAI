/**
 * Generates scripts/fixtures/test-schedule.png — a realistic class-schedule
 * table rendered from SVG via sharp. Used by scripts/smoke.sh to exercise the
 * upload + OCR pipeline (with the mock provider, the image content doesn't
 * matter, but a realistic one also works great with the real Gemini provider).
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "fixtures");
const outFile = path.join(outDir, "test-schedule.png");

fs.mkdirSync(outDir, { recursive: true });

const rows: Array<[string, string, string, string, string]> = [
  ["Web Development", "MWF", "8:00 AM - 9:30 AM", "Room 201", "Juan Dela Cruz"],
  ["Database Systems", "TTh", "10:00 AM - 11:30 AM", "Room 305", "Maria Santos"],
  ["Networking", "F", "1:00 PM - 4:00 PM", "Room 110", "Andres Reyes"],
  ["Software Engineering", "MW", "2:00 PM - 3:30 PM", "Room 402", "Ana Cruz"],
  ["Discrete Mathematics", "TTh", "4:00 PM - 5:30 PM", "Room 118", "Roberto Lim"],
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const colX = [40, 300, 420, 650, 800]; // x positions for the 5 columns
const headerY = 70;
const rowH = 52;
const tableW = 1100;
const tableH = headerY + 20 + rows.length * rowH + 10;

let rowSvg = "";
rows.forEach((row, i) => {
  const y = headerY + 20 + i * rowH + 34;
  const bg = i % 2 === 0 ? "#ffffff" : "#f3f4f6";
  rowSvg += `<rect x="30" y="${y - 34}" width="${tableW - 60}" height="${rowH}" fill="${bg}"/>`;
  row.forEach((cell, j) => {
    rowSvg += `<text x="${colX[j]}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#111827">${esc(cell)}</text>`;
  });
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tableW}" height="${tableH + 60}" viewBox="0 0 ${tableW} ${tableH + 60}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="40" y="40" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="#111827">Class Schedule — 1st Semester 2026-2027</text>
  <rect x="30" y="${headerY - 30}" width="${tableW - 60}" height="50" fill="#e5e7eb"/>
  <text x="${colX[0]}" y="${headerY}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#111827">Subject</text>
  <text x="${colX[1]}" y="${headerY}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#111827">Day</text>
  <text x="${colX[2]}" y="${headerY}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#111827">Time</text>
  <text x="${colX[3]}" y="${headerY}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#111827">Room</text>
  <text x="${colX[4]}" y="${headerY}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#111827">Instructor</text>
  ${rowSvg}
  <rect x="30" y="${headerY - 30}" width="${tableW - 60}" height="${20 + rows.length * rowH + 40}" fill="none" stroke="#9ca3af" stroke-width="2"/>
</svg>`;

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outFile)
  .then((info) => {
    console.log(`✅ Wrote ${outFile} (${info.width}x${info.height}, ${Math.round(info.size / 1024)}KB)`);
  })
  .catch((err) => {
    console.error("❌ Failed to generate test image:", err);
    process.exit(1);
  });
