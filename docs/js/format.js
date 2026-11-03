// Deutsche Schreibweise für Zahlen, Prozent und Zeiten.
const ganz = new Intl.NumberFormat("de-DE");
const eineStelle = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const zwei = (n) => String(n).padStart(2, "0");
const alsDatum = (iso) => (iso instanceof Date ? iso : new Date(iso));

const ZEICHEN = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ZEICHEN[c]);

export const zahl = (n) => (n === null || n === undefined || Number.isNaN(n) ? "–" : ganz.format(Math.round(n)));
export const prozent = (x) => `${Math.abs(x) >= 1 ? ganz.format(Math.round(x * 100)) : eineStelle.format(x * 100)} %`;
export const geld = (usd) => `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd)} $`;

export function zeit(iso) {
  const d = alsDatum(iso);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

export function tag(iso) {
  const d = alsDatum(iso);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function vor(iso, jetzt = new Date()) {
  const min = Math.floor((jetzt - alsDatum(iso)) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 48) return `vor ${std} Std.`;
  return `vor ${Math.floor(std / 24)} Tagen`;
}
