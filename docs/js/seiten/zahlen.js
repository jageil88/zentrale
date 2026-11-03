// Zahlen: Zähler, Aktien-Verläufe, Kreise und Erfolge.
import { aktienDiagramm } from "../diagramm-linie.js";
import { kreisDiagramm, ringMeter } from "../diagramm-kreis.js";
import { anteile } from "../kennzahlen.js";
import { prozent, esc } from "../format.js";
import { banner, zaehler } from "./teile.js";

const ART = { geschichte: "Geschichte", aktuell: "Aktuell", zeitlos: "Zeitlos" };
const GESEHEN = "zentrale-erfolge";
const POKAL = '<svg class="pokal" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8v-3H8z"/></svg>';

const kurz = (s, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function gesehen() {
  try { return new Set(JSON.parse(localStorage.getItem(GESEHEN) || "[]")); } catch { return new Set(); }
}

function merken(ids) {
  try { localStorage.setItem(GESEHEN, JSON.stringify([...ids])); } catch { /* ohne Merken ploppen sie eben wieder */ }
}

export const zahlen = {
  zeichne(main, k) {
    const a = k.ansicht;
    const namen = new Map(a.videos.filter((v) => v.tiktok?.video_id).map((v) => [v.tiktok.video_id, `Video ${v.nr}: ${v.titel}`]));
    const proVideo = anteile(a.tabelle.map((t) => ({ name: kurz(namen.get(t.video_id) ?? t.titel ?? "Video"), wert: t.aufrufe })));
    const arten = a.arten.map((x) => ({ ...x, name: ART[x.name] ?? x.name }));
    const schon = gesehen();
    const erfolge = a.erfolge.map((e) => {
      const neu = e.erreicht && !schon.has(e.id);
      return `<li class="erfolg ${e.erreicht ? "an" : "aus"}${neu ? " neu" : ""}">${POKAL}<span>${esc(e.name)}</span>${e.erreicht ? "" : '<span class="sr">(noch nicht erreicht)</span>'}</li>`;
    }).join("");
    const erreicht = a.erfolge.filter((e) => e.erreicht).length;

    main.innerHTML = `<h1>Zahlen</h1>${banner(a)}
      <div class="zaehler-reihe">
        ${zaehler("Follower", a.profil?.follower, a.seitGestern.follower)}
        ${zaehler("Likes", a.profil?.likes, a.seitGestern.likes)}
        ${zaehler("Aufrufe", a.aufrufeGesamt, a.seitGestern.aufrufe)}
      </div>
      <div class="zwei">
        <section data-d="follower"></section>
        <section data-d="likes"></section>
        <section data-d="aufrufe"></section>
        <section data-k="videos"></section>
        <section data-k="arten"></section>
        <section data-k="quote"></section>
      </div>
      <h2>Erfolge <span class="leise klein">${erreicht} von ${a.erfolge.length}</span></h2>
      <ul class="erfolge">${erfolge}</ul>`;

    const feld = (sel) => main.querySelector(sel);
    aktienDiagramm(feld('[data-d="follower"]'), { titel: "Follower", punkte: a.verlauf.follower, jetzt: a.jetzt });
    aktienDiagramm(feld('[data-d="likes"]'), { titel: "Likes", punkte: a.verlauf.likes, jetzt: a.jetzt });
    aktienDiagramm(feld('[data-d="aufrufe"]'), { titel: "Aufrufe", punkte: a.verlauf.aufrufe, jetzt: a.jetzt });
    kreisDiagramm(feld('[data-k="videos"]'), { titel: "Anteil der Aufrufe je Video", teile: proVideo });
    kreisDiagramm(feld('[data-k="arten"]'), { titel: "Aufrufe nach Video-Art", teile: arten });
    ringMeter(feld('[data-k="quote"]'), {
      titel: "Like-Quote", wert: a.likeQuote ?? 0, max: 1,
      text: a.likeQuote === null ? "–" : prozent(a.likeQuote), unter: "So viele Zuschauer liken ein Video.",
    });
    merken(new Set([...schon, ...a.erfolge.filter((e) => e.erreicht).map((e) => e.id)]));
  },
};
