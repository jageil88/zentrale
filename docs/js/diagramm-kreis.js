// Kreise für kleine Sachen: Anteile (höchstens 5 Teile, 2 px Lücke) und Ring-Meter für einzelne Quoten.
// Beide bauen sich im selben 4-Sekunden-Takt auf wie die Aktien-Verläufe.
import { aufbauen } from "./aufbau.js";
import { prozent, zahl, esc } from "./format.js";

export const KATEGORIEN = ["#04A3BE", "#DC467D", "#C58501", "#8169DD"];
const REST = "#6E6496";
const R = 40;
const UMFANG = 2 * Math.PI * R;

// Sichtbare Länge jedes Teils bei Fortschritt p (0–1), im Uhrzeigersinn ab 12 Uhr.
export function segmente(anteile, umfang, luecke, p) {
  const sichtbar = p * umfang;
  let start = 0;
  return anteile.map((a) => {
    const voll = anteile.length > 1 ? Math.max(0, a * umfang - luecke) : umfang;
    const s = { start, laenge: Math.max(0, Math.min(voll, sichtbar - start)) };
    start += a * umfang;
    return s;
  });
}

export function kreisDiagramm(el, { titel, teile, format = zahl, beschreibung = "" }) {
  el.classList.add("panel");
  if (teile.length < 2) {
    const einzig = teile[0];
    el.innerHTML = `<h3>${esc(titel)}</h3>${einzig
      ? `<p><span class="wert gross-zahl">${esc(format(einzig.wert))}</span> <span class="leise">${esc(einzig.name)}</span></p>`
      : '<p class="leise">Noch keine Daten.</p>'}`;
    return;
  }
  const farbe = (t, i) => (t.name === "Rest" ? REST : KATEGORIEN[i % KATEGORIEN.length]);
  el.innerHTML = `<h3>${esc(titel)}</h3>
    <div class="kreis">
      <svg viewBox="0 0 100 100" role="img" aria-label="${esc(titel)}: ${esc(teile.map((t) => `${t.name} ${prozent(t.anteil)}`).join(", "))}">
        <g transform="rotate(-90 50 50)">${teile.map((t, i) => `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${farbe(t, i)}" stroke-width="14"/>`).join("")}</g>
      </svg>
      <ul class="legende">${teile.map((t, i) => `<li><span class="farbe" style="background:${farbe(t, i)}"></span>${esc(t.name)}<b>${prozent(t.anteil)}</b></li>`).join("")}</ul>
    </div>${beschreibung ? `<p class="leise klein">${esc(beschreibung)}</p>` : ""}`;
  const kreise = [...el.querySelectorAll("circle")];
  aufbauen(el, (p) => {
    segmente(teile.map((t) => t.anteil), UMFANG, 2, p).forEach((s, i) => {
      kreise[i].setAttribute("stroke-dasharray", `${s.laenge.toFixed(2)} ${UMFANG.toFixed(2)}`);
      kreise[i].setAttribute("stroke-dashoffset", (-s.start).toFixed(2));
    });
  });
}

export function ringMeter(el, { titel, wert, max, text, unter = "" }) {
  el.classList.add("panel");
  const anteil = max ? Math.min(1, Math.max(0, (wert ?? 0) / max)) : 0;
  el.innerHTML = `<h3>${esc(titel)}</h3>
    <div class="kreis">
      <svg viewBox="0 0 100 100" role="img" aria-label="${esc(titel)}: ${esc(text)}">
        <circle class="spur" cx="50" cy="50" r="${R}" fill="none" stroke-width="12"/>
        <circle class="ring" cx="50" cy="50" r="${R}" fill="none" stroke-width="12" transform="rotate(-90 50 50)" stroke-dasharray="0 ${UMFANG.toFixed(2)}"/>
        <text class="ring-text" x="50" y="55" text-anchor="middle">${esc(text)}</text>
      </svg>
      ${unter ? `<p class="leise">${esc(unter)}</p>` : ""}
    </div>`;
  const ring = el.querySelector(".ring");
  aufbauen(el, (p) => ring.setAttribute("stroke-dasharray", `${(anteil * UMFANG * p).toFixed(2)} ${UMFANG.toFixed(2)}`));
}
