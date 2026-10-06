// Generates the dark-mode colour rules in src/app/globals.css.
//
// Most screens are written with plain Tailwind colours (bg-white, text-gray-700, bg-teal-50 …) and
// no `dark:` variants, so switching to dark mode only darkened the page background. This scans every
// colour utility used in src/ and writes a dark equivalent for each one (including hover/focus/data-state
// variants and gradient stops) between the DARK-COLORS markers in globals.css.
//
//   node scripts/generate-dark-colors.mjs       (or: npm run dark-colors)
//
// Re-run it after adding new colour classes. Elements that already use their own `dark:` classes still win.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(path.join(root, "package.json"));
const colors = require("tailwindcss/colors");

const NEUTRALS = ["gray", "slate", "zinc", "neutral", "stone"];
const HUES = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const BASE = "#0f172a"; // card surface in dark mode (page background is darker, set by --background)

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
const hue = (h, s) => colors[h][s];

// ── dark equivalents ──────────────────────────────────────────────────────
const N_BG = { 50: "#0b1220", 100: "#1f2b44", 200: "#2c3a56", 300: "#3b4a68", 400: "#556580" };
const N_BORDER = { 50: "#1a2438", 100: "#1e293b", 200: "#2c3a56", 300: "#3b4a68", 400: "#556580" };
const N_TEXT = { 300: "#94a3b8", 400: "#8394aa", 500: "#94a3b8", 600: "#cbd5e1", 700: "#e2e8f0", 800: "#f1f5f9", 900: "#f1f5f9", 950: "#f1f5f9" };
const N_GRAD = { 50: "#0a1020", 100: "#0e1628", 200: "#16203a", 300: "#223050" };
const TINT_BG = { 50: 0.12, 100: 0.18, 200: 0.28, 300: 0.38 };
const TINT_BORDER = { 50: 0.2, 100: 0.22, 200: 0.32, 300: 0.42 };
const H_TEXT = { 600: 400, 700: 300, 800: 200, 900: 200, 950: 200 };
const H_GRAD = { 600: 800, 700: 900, 800: 950, 900: 950 };

// Returns a hex colour for the dark theme, or null to leave the class alone.
function darkColor(prop, name) {
  const isGrad = prop === "from" || prop === "via" || prop === "to";
  const surface = prop === "bg" || isGrad;
  const edge = prop === "border" || prop === "ring" || prop === "divide";
  if (name === "white") return surface || prop === "ring" ? BASE : null;
  if (name === "black" || name === "transparent") return null;
  const [family, shade] = name.split("-");
  if (NEUTRALS.includes(family)) {
    if (isGrad) return N_GRAD[shade] ?? null;
    if (surface) return N_BG[shade] ?? null;
    if (edge) return N_BORDER[shade] ?? null;
    if (prop === "text") return N_TEXT[shade] ?? null;
    return null;
  }
  if (!HUES.includes(family)) return null;
  const mixed = (table) => (table[shade] !== undefined ? mix(BASE, hue(family, 500), table[shade]) : null);
  if (isGrad) return mixed(TINT_BG) ?? (H_GRAD[shade] ? hue(family, H_GRAD[shade]) : null);
  if (surface) return mixed(TINT_BG);
  if (edge) return mixed(TINT_BORDER);
  if (prop === "text") return H_TEXT[shade] ? hue(family, H_TEXT[shade]) : null;
  return null;
}

// ── collect the colour classes in use ─────────────────────────────────────
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(p);
  }
})(path.join(root, "src"));

const fam = [...NEUTRALS, ...HUES].join("|");
const re = new RegExp(
  `(?<![\\w\\-/])((?:(?:[a-z\\-]+|data-\\[[^\\]\\s]+\\]|aria-[a-z]+):)*)(bg|text|border|ring|from|via|to|divide)-(white|black|transparent|(?:${fam})-(?:${SHADES.join("|")}))(?:/(\\d{1,3}))?(?![\\w\\-])`,
  "g"
);
const used = new Map();
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const m of text.matchAll(re)) used.set(m[0], { variants: m[1], prop: m[2], name: m[3], alpha: m[4] });
}

// ── build the CSS ─────────────────────────────────────────────────────────
const esc = (s) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
const PSEUDO = { hover: ":hover", focus: ":focus", "focus-visible": ":focus-visible", "focus-within": ":focus-within", active: ":active", disabled: ":disabled", placeholder: "::placeholder" };
const MEDIA = { sm: 640, md: 768, lg: 1024, xl: 1280 };
const withAlpha = (hex, alpha) => {
  if (alpha === undefined) return hex;
  const [r, g, b] = hex2rgb(hex);
  return `rgb(${r} ${g} ${b} / ${Number(alpha) / 100})`;
};

const rules = [];
const skipped = [];
for (const [cls, { variants, prop, name, alpha }] of used) {
  const vs = variants ? variants.slice(0, -1).split(":") : [];
  if (vs.includes("dark")) continue; // already has its own dark styling

  // translucent white is used for glass effects on photos/gradients; only the near-solid ones are surfaces
  if (name === "white" && alpha !== undefined && Number(alpha) < 75) continue;
  const hex = darkColor(prop, name);
  if (!hex) continue;
  const c = withAlpha(hex, alpha);
  const [r, g, b] = hex2rgb(hex);
  const clear = `rgb(${r} ${g} ${b} / 0)`;

  let pseudo = "", group = "", media = 0, ok = true;
  for (const v of vs) {
    if (PSEUDO[v]) pseudo += PSEUDO[v];
    else if (v === "group-hover") group = ".group:hover ";
    else if (v.startsWith("data-[")) pseudo += "[" + v.slice(6, -1) + "]";
    else if (MEDIA[v]) media = MEDIA[v];
    else ok = false;
  }
  if (!ok) { skipped.push(cls); continue; }
  const sel = `:where(.dark) ${group}.${esc(cls)}${pseudo}`;
  const gradient = prop === "from" ? `--tw-gradient-from:${c} var(--tw-gradient-from-position);--tw-gradient-to:${clear} var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)`
    : prop === "via" ? `--tw-gradient-to:${clear} var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),${c} var(--tw-gradient-via-position),var(--tw-gradient-to)`
    : prop === "to" ? `--tw-gradient-to:${c} var(--tw-gradient-to-position)`
    : "";
  const decl =
    prop === "bg" ? `background-color:${c}`
    : prop === "text" ? `color:${c}`
    : prop === "border" ? `border-color:${c}`
    : prop === "ring" ? `--tw-ring-color:${c}`
    : gradient;
  if (prop === "divide") {
    rules.push([media, `:where(.dark) .${esc(cls)}>:not([hidden])~:not([hidden]){border-color:${c}}`]);
    continue;
  }
  rules.push([media, `${sel}{${decl}}`]);
}

// Brand colours that come from CSS variables rather than palette classes.
const manual = `
/* brand gradients (sidebar, marketplace banner) */
:where(.dark) .from-\\[var\\(--brand-600\\)\\]{--tw-gradient-from:#0b3f3b var(--tw-gradient-from-position);--tw-gradient-to:rgb(11 63 59 / 0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}
:where(.dark) .to-\\[var\\(--brand-700\\)\\]{--tw-gradient-to:#082d2b var(--tw-gradient-to-position)}
:where(.dark) .marketplace-theme .from-\\[var\\(--brand-700\\)\\]{--tw-gradient-from:#0b1f4a var(--tw-gradient-from-position);--tw-gradient-to:rgb(11 31 74 / 0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}
:where(.dark) .marketplace-theme .via-\\[var\\(--brand-600\\)\\]{--tw-gradient-to:rgb(18 48 110 / 0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),#12306e var(--tw-gradient-via-position),var(--tw-gradient-to)}
:where(.dark) .marketplace-theme .to-\\[var\\(--brand-500\\)\\]{--tw-gradient-to:#1e40af var(--tw-gradient-to-position)}
:where(.dark) .marketplace-theme .from-\\[var\\(--brand-600\\)\\]{--tw-gradient-from:#12306e var(--tw-gradient-from-position);--tw-gradient-to:rgb(18 48 110 / 0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)}
:where(.dark) .marketplace-theme .to-\\[var\\(--brand-700\\)\\]{--tw-gradient-to:#0b1f4a var(--tw-gradient-to-position)}
/* phone top bar (the only sticky brand-coloured bar) */
:where(.dark) .sticky.bg-\\[var\\(--brand-600\\)\\]{background-color:#0b3f3b}
/* teal brand text / tints from variables */
:where(.dark){--brand-50:#0b2b2a;--brand-500:#2dd4bf}
:where(.dark) .text-\\[var\\(--brand-600\\)\\]{color:#2dd4bf}
:where(.dark) .text-\\[var\\(--brand-700\\)\\],:where(.dark) .hover\\:text-\\[var\\(--brand-700\\)\\]:hover{color:#5eead4}
:where(.dark) .marketplace-theme .text-\\[var\\(--brand-600\\)\\]{color:#60a5fa}
:where(.dark) .marketplace-theme .text-\\[var\\(--brand-700\\)\\],:where(.dark) .marketplace-theme .hover\\:text-\\[var\\(--brand-700\\)\\]:hover{color:#93c5fd}
:where(.dark) .bg-\\[var\\(--brand-50\\)\\]{background-color:var(--brand-50)}
:where(.dark) .border-\\[var\\(--brand-600\\)\\]{border-color:#2dd4bf}
:where(.dark) .marketplace-theme .border-\\[var\\(--brand-600\\)\\]{border-color:#3b82f6}
/* native form controls, scrollbars and autofill follow the theme */
.dark{color-scheme:dark}
`;

rules.sort((a, b) => a[0] - b[0]);
const plain = rules.filter((r) => !r[0]).map((r) => r[1]);
const byMedia = {};
for (const [m, css] of rules) if (m) (byMedia[m] ??= []).push(css);
let out = `/* Generated by scripts/generate-dark-colors.mjs from the colour classes used in src/. Do not edit by hand. */\n`;
out += [...new Set(plain)].join("\n") + "\n";
for (const m of Object.keys(byMedia)) out += `@media (min-width:${m}px){\n${[...new Set(byMedia[m])].join("\n")}\n}\n`;
out += manual;

const cssPath = path.join(root, "src", "app", "globals.css");
let css = fs.readFileSync(cssPath, "utf8");
const START = "/* DARK-COLORS:START */", END = "/* DARK-COLORS:END */";
const block = `${START}\n${out}${END}`;
if (css.includes(START)) css = css.replace(new RegExp(`${START.replace(/[*/]/g, "\\$&")}[\\s\\S]*?${END.replace(/[*/]/g, "\\$&")}`), () => block);
else css += `\n${block}\n`;
fs.writeFileSync(cssPath, css);
console.log(`${used.size} colour classes found, ${rules.length} dark rules written${skipped.length ? `, skipped ${skipped.length}: ${skipped.join(" ")}` : ""}.`);
