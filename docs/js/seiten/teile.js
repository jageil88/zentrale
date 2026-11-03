// Bausteine, die mehrere Seiten teilen: Zähler, Banner, XP-Balken, Status, PC-Aktionen, entschlüsselte Dateien.
import { aufbauen } from "../aufbau.js";
import { ladeDatei } from "../daten.js";
import { zahl, vor, esc } from "../format.js";

export const STATUS = {
  idee: "Idee", in_arbeit: "In Arbeit", fertig: "Fertig", entwurf: "Entwurf in deinem TikTok",
  hochgeladen: "Online", verworfen: "Verworfen",
};

export function zaehler(name, wert, seitGestern) {
  const richtung = seitGestern > 0 ? "hoch" : seitGestern < 0 ? "runter" : "gleich";
  const chip = seitGestern === null || seitGestern === undefined
    ? '<span class="chip">noch kein Vortag</span>'
    : `<span class="chip ${richtung}">${seitGestern > 0 ? "▲ +" : seitGestern < 0 ? "▼ −" : "± "}${zahl(Math.abs(seitGestern))} seit gestern</span>`;
  return `<div class="zaehler panel"><div class="panel-kopf">${esc(name)}</div><div class="wert zaehler-wert">${zahl(wert)}</div>${chip}</div>`;
}

export function banner(a) {
  const teile = [];
  if (a.alt.cloud) {
    teile.push(a.stand.cloud
      ? `Letzte Zahlen ${esc(vor(a.stand.cloud, a.jetzt))}. Der Cloud-Abruf hängt gerade.`
      : "Noch keine Zahlen aus der Cloud. Der erste Abruf kommt nach dem Einrichten.");
  }
  if (a.alt.pc) {
    teile.push(a.stand.pc ? `Der PC war ${esc(vor(a.stand.pc, a.jetzt))} zuletzt online.` : "Vom PC sind noch keine Daten da.");
  }
  return teile.map((t) => `<div class="banner" role="status"><span>${t}</span></div>`).join("");
}

export function levelText(lv) {
  return lv.bis === null ? "Höchstes Level erreicht" : `${zahl(lv.bis - lv.von - Math.round(lv.fortschritt * (lv.bis - lv.von)))} Follower bis Level ${lv.level + 1}`;
}

export function xpBalken(el, lv, folger) {
  el.innerHTML = `<div class="xp-zeile"><span>${esc(levelText(lv))}</span><span class="wert">${zahl(folger)} / ${lv.bis === null ? "–" : zahl(lv.bis)}</span></div>
    <div class="balken" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(lv.fortschritt * 100)}" aria-label="Fortschritt zum nächsten Level"><span></span></div>`;
  const fuellung = el.querySelector(".balken > span");
  aufbauen(el, (p) => { fuellung.style.width = `${lv.fortschritt * p * 100}%`; });
}

// PC-Knöpfe schicken ihre Wünsche an die lokale Zentrale; online gibt es sie nicht.
export async function aktion(pfad, body = {}) {
  const r = await fetch(pfad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const daten = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(daten.fehler || "Die Zentrale am PC hat nicht geantwortet.");
  return daten;
}

// Video und Vorschau: online entschlüsselt (nur das neueste ungepostete), am PC direkt aus dem Video-Ordner.
const cache = new Map();
export async function dateiUrl(k, video, art) {
  if (k.modus === "pc") {
    const rel = art === "video" ? video.datei : video.vorschau;
    return rel && video.ordner ? `/media/${encodeURIComponent(video.ordner)}/${rel.split("/").map(encodeURIComponent).join("/")}` : null;
  }
  const neu = k.ansicht.neu;
  if (!neu || neu.nr !== video.nr || !neu[art]) return null;
  const schluessel = `${neu.nr}-${art}-${k.ansicht.stand.pc}`;
  if (!cache.has(schluessel)) {
    cache.set(schluessel, ladeDatei(k.key, fetch, k.basis, neu[art], art === "video" ? "video/mp4" : "image/jpeg")
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null));
  }
  return cache.get(schluessel);
}

export const nurAmPc = '<p class="leise klein">Weitere Knöpfe gibt es, wenn du die Zentrale am PC öffnest.</p>';
