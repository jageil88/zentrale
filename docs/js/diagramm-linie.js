// Aktien-Verlauf: Linie mit Fläche, Zeitraum-Knöpfe, Fadenkreuz und der 4-Sekunden-Aufbau.
// Grün, wenn es im Zeitraum hochging, rot, wenn es runterging, neutral ohne Änderung.
import { aufbauen } from "./aufbau.js";
import { trend, zeitraum } from "./kennzahlen.js";
import { zahl, prozent, zeit, esc } from "./format.js";

const HOEHE = 180;
const RAND = 12;
const ZEITRAEUME = ["1T", "1W", "1M", "Alles"];
const NAMEN = { "1T": "letzte 24 Stunden", "1W": "letzte Woche", "1M": "letzter Monat", Alles: "seit Beginn" };
let zaehler = 0;

export function skala(min, max, hoehe, rand) {
  if (max === min) return () => hoehe / 2;
  return (w) => rand + (1 - (w - min) / (max - min)) * (hoehe - 2 * rand);
}

export function pfad(punkte, breite, hoehe, rand = RAND) {
  if (punkte.length < 2) return null;
  const werte = punkte.map((x) => x.wert ?? 0);
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const t0 = +punkte[0].zeit;
  const t1 = +punkte[punkte.length - 1].zeit;
  const x = (t) => (t1 === t0 ? breite / 2 : rand + ((t - t0) / (t1 - t0)) * (breite - 2 * rand));
  const y = skala(min, max, hoehe, rand);
  const xy = punkte.map((pt, i) => [x(+pt.zeit), y(werte[i])]);
  const linie = `M${xy.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" L")}`;
  const flaeche = `${linie} L${xy[xy.length - 1][0].toFixed(1)},${hoehe} L${xy[0][0].toFixed(1)},${hoehe} Z`;
  return { linie, flaeche, xy, min, max, y };
}

export function naechster(xy, x) {
  let beste = 0;
  for (let i = 1; i < xy.length; i += 1) if (Math.abs(xy[i][0] - x) < Math.abs(xy[beste][0] - x)) beste = i;
  return beste;
}

// Höhe der Linie an der Stelle x – dort sitzt die Spitze, die sich beim Aufbau nach rechts schiebt.
export function kopfBei(xy, x) {
  if (x <= xy[0][0]) return [...xy[0]];
  for (let i = 0; i < xy.length - 1; i += 1) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[i + 1];
    if (x <= x2) return [x, x2 === x1 ? y2 : y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)];
  }
  return [...xy[xy.length - 1]];
}

function chipText(t, format) {
  if (t.richtung === "gleich") return "± 0";
  const zeichen = t.diff > 0 ? "+" : "−";
  const pfeil = t.diff > 0 ? "▲" : "▼";
  const anteil = t.prozent === null ? "" : ` (${zeichen}${prozent(Math.abs(t.prozent))})`;
  return `${pfeil} ${zeichen}${format(Math.abs(t.diff))}${anteil}`;
}

export function aktienDiagramm(el, { titel, punkte, jetzt, format = zahl, start = "1W" }) {
  const id = `ausschnitt-${(zaehler += 1)}`;
  let name = start;
  let daten = [];
  let t = trend([]);
  let form = null;
  let breite = 0;
  let p = 0;

  el.classList.add("panel", "aktie");
  el.innerHTML = `
    <div class="aktie-kopf">
      <h3>${esc(titel)}</h3>
      <div class="zeitraum" role="group" aria-label="Zeitraum">
        ${ZEITRAEUME.map((z) => `<button type="button" data-zeitraum="${z}" aria-pressed="${z === name}">${z}</button>`).join("")}
      </div>
    </div>
    <div class="aktie-wert"><span class="wert"></span><span class="chip"></span></div>
    <div class="aktie-flaeche"><svg role="img"></svg><div class="tipp" hidden></div></div>
    <p class="leise zu-wenig" hidden>Noch zu wenig Daten für diesen Zeitraum.</p>
    <details class="tabelle"><summary>Als Tabelle zeigen</summary><div></div></details>`;
  const flaecheEl = el.querySelector(".aktie-flaeche");
  const svg = el.querySelector("svg");
  const wertEl = el.querySelector(".wert");
  const chip = el.querySelector(".chip");
  const tipp = el.querySelector(".tipp");
  const zuWenig = el.querySelector(".zu-wenig");
  const tabelle = el.querySelector(".tabelle div");

  function berechnen() {
    daten = zeitraum(punkte, name, jetzt);
    t = trend(daten);
    const zeilen = daten.slice(-50).reverse().map((d) => `<tr><td>${zeit(d.zeit)}</td><td>${format(d.wert)}</td></tr>`).join("");
    tabelle.innerHTML = `<table><tr><th>Zeit</th><th>${esc(titel)}</th></tr>${zeilen}</table>`;
    svg.setAttribute("aria-label", t.start === null
      ? `${titel}: noch keine Daten`
      : `${titel}, ${NAMEN[name]}: von ${format(t.start)} auf ${format(t.ende)}`);
  }

  function zeichnen() {
    breite = Math.max(240, Math.round(flaecheEl.clientWidth));
    form = pfad(daten, breite, HOEHE);
    svg.hidden = !form;
    zuWenig.hidden = Boolean(form);
    if (form) {
      const stufen = form.min === form.max ? [form.min] : [form.max, (form.min + form.max) / 2, form.min];
      const gitter = stufen.map((w) => {
        const y = form.y(w).toFixed(1);
        return `<line x1="0" x2="${breite}" y1="${y}" y2="${y}"/><text x="${breite - 2}" y="${(+y - 4).toFixed(1)}" text-anchor="end">${esc(format(w))}</text>`;
      }).join("");
      svg.setAttribute("viewBox", `0 0 ${breite} ${HOEHE}`);
      svg.innerHTML = `<defs><clipPath id="${id}"><rect x="0" y="-4" width="0" height="${HOEHE + 8}"/></clipPath></defs>
        <g class="gitter">${gitter}</g>
        <g class="verlauf ${t.richtung}" clip-path="url(#${id})"><path class="flaeche" d="${form.flaeche}"/><path class="linie" d="${form.linie}"/></g>
        <g class="fadenkreuz" hidden><line y1="0" y2="${HOEHE}"/><circle class="kopf-punkt ${t.richtung}" r="4"/></g>
        <circle class="kopf-punkt spitze ${t.richtung}" r="4"/>`;
    }
    schritt(p);
  }

  function schritt(q) {
    p = q;
    wertEl.textContent = t.start === null ? "–" : format(t.start + (t.ende - t.start) * q);
    chip.textContent = chipText(t, format);
    chip.className = `chip ${t.richtung}${q >= 1 ? " da" : ""}`;
    if (!form) return;
    const kopfX = RAND + q * (breite - 2 * RAND);
    svg.querySelector(`#${id} rect`).setAttribute("width", (kopfX + 3).toFixed(1));
    const [hx, hy] = kopfBei(form.xy, kopfX);
    const spitze = svg.querySelector(".spitze");
    spitze.setAttribute("cx", hx.toFixed(1));
    spitze.setAttribute("cy", hy.toFixed(1));
  }

  function fadenkreuz(e) {
    if (!form || p < 1) return;
    const r = svg.getBoundingClientRect();
    const i = naechster(form.xy, (e.clientX - r.left) * (breite / r.width));
    const [x, y] = form.xy[i];
    const kreuz = svg.querySelector(".fadenkreuz");
    kreuz.hidden = false;
    kreuz.querySelector("line").setAttribute("x1", x);
    kreuz.querySelector("line").setAttribute("x2", x);
    kreuz.querySelector("circle").setAttribute("cx", x);
    kreuz.querySelector("circle").setAttribute("cy", y);
    tipp.hidden = false;
    tipp.textContent = `${zeit(daten[i].zeit)}: ${format(daten[i].wert)}`;
    const links = (x / breite) * r.width;
    tipp.style.left = `${Math.min(Math.max(0, links - tipp.offsetWidth / 2), r.width - tipp.offsetWidth)}px`;
  }

  svg.addEventListener("pointermove", fadenkreuz);
  svg.addEventListener("pointerdown", fadenkreuz);
  svg.addEventListener("pointerleave", () => {
    tipp.hidden = true;
    const kreuz = svg.querySelector(".fadenkreuz");
    if (kreuz) kreuz.hidden = true;
  });

  const aufbau = aufbauen(el, schritt);
  el.querySelector(".zeitraum").addEventListener("click", (e) => {
    const knopf = e.target.closest("[data-zeitraum]");
    if (!knopf) return;
    name = knopf.dataset.zeitraum;
    el.querySelectorAll("[data-zeitraum]").forEach((b) => b.setAttribute("aria-pressed", String(b === knopf)));
    berechnen();
    zeichnen();
    aufbau.neu();
  });
  new ResizeObserver(() => { if (Math.abs(flaecheEl.clientWidth - breite) > 2) zeichnen(); }).observe(flaecheEl);

  berechnen();
  zeichnen();
  return {
    aktualisieren(neu) {
      punkte = neu;
      berechnen();
      zeichnen();
    },
  };
}
