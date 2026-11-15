/**
 * WCAG contrast check for every text/background pair the UI uses.
 *   npx tsx scripts/check-contrast.ts
 * Normal text needs 4.5:1, large text (≥ 24px, or ≥ 19px bold) 3:1, and UI boundaries
 * such as input borders 3:1. Colours come straight from app/globals.css and Tailwind's
 * own theme file, so this checks what the browser actually renders. Exits 1 on any failure.
 */
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8") + readFileSync("node_modules/tailwindcss/theme.css", "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`unknown colour token: ${name}`);
  return m[1].trim();
}

type RGB = [number, number, number];

/** oklch(L C H) → sRGB 0..1 (Tailwind v4 defines its palette in OKLCH). */
function oklchToRgb(l: number, c: number, h: number): RGB {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const [L, M, S] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as RGB;
}

function parse(value: string): RGB {
  if (value.startsWith("#")) {
    const h = value.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
  }
  const m = value.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
  if (m) return oklchToRgb(parseFloat(m[1]) / (value.includes("%") ? 100 : 1), parseFloat(m[2]), parseFloat(m[3]));
  throw new Error(`can't parse colour ${value}`);
}

const colour = (name: string): RGB => (name === "white" ? [1, 1, 1] : parse(name.startsWith("#") ? name : token(name)));

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg: string, bg: string): number {
  const [a, b] = [luminance(colour(fg)), luminance(colour(bg))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

type Kind = "text" | "large" | "ui";
const NEED: Record<Kind, number> = { text: 4.5, large: 3, ui: 3 };

// [foreground, background, kind, where it's used]
const PAIRS: [string, string, Kind, string][] = [
  // Main text tokens on every surface they appear on
  ...(["white", "page", "slate-50", "slate-100", "navy-50", "gold-50"] as const).flatMap((bg) => [
    ["ink", bg, "text", "body text"] as [string, string, Kind, string],
    ["ink-muted", bg, "text", "secondary text"] as [string, string, Kind, string],
  ]),
  ["gold-ink", "white", "text", "gold text (eyebrows, headline accent)"],
  ["gold-ink", "gold-50", "text", "gold badge"],
  ["gold-ink", "page", "text", "gold text on page background"],
  ["signal", "white", "text", "Command Center accent text"],
  ["signal", "page", "text", "Command Center accent on grid background"],
  ["slate-500", "white", "text", "placeholders, older pages' muted text"],
  ["slate-500", "slate-50", "text", "older pages' muted text on gray"],
  ["slate-600", "white", "text", "older pages"],
  ["slate-700", "white", "text", "older pages"],
  // Fills with text on top
  ["navy-950", "gt-gold", "text", "gold button / active chip label"],
  ["white", "gt-navy", "text", "navy button label"],
  ["white", "gt-navy-700", "text", "navy button hover"],
  // Badges (text on its tinted background)
  ["slate-700", "slate-100", "text", "Submitted badge"],
  ["sky-800", "sky-50", "text", "Assigned / Medium badge"],
  ["amber-800", "amber-50", "text", "In progress badge"],
  ["emerald-800", "emerald-50", "text", "Resolved badge"],
  ["slate-700", "slate-50", "text", "Low badge"],
  ["orange-800", "orange-50", "text", "High badge"],
  ["red-800", "red-50", "text", "Urgent badge / alert KPI"],
  ["ink", "white", "text", "area badge"],
  // Feedback
  ["red-700", "white", "text", "form errors"],
  ["emerald-700", "white", "text", "KPI good change"],
  ["red-700", "white", "text", "KPI bad change"],
  ["amber-800", "amber-50", "text", "setup notice"],
  ["emerald-700", "emerald-100", "large", "toast success icon"],
  ["red-700", "red-100", "large", "toast error icon"],
  // Headline sizes (large text)
  ["gold-ink", "white", "large", "headline accent"],
  // Non-text UI boundaries
  ["field", "white", "ui", "input borders"],
  ["gt-navy", "white", "ui", "focused input border / selection ring"],
];

let failures = 0;
console.log("WCAG contrast check\n");
for (const [fg, bg, kind, where] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= NEED[kind];
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (needs ${NEED[kind]})  ${fg} on ${bg}  — ${where}`);
}
console.log(`\n${PAIRS.length - failures}/${PAIRS.length} pairs pass`);
process.exit(failures ? 1 : 0);
