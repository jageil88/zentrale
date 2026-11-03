// Startseite: jedes Projekt ist ein Spielstand. Jetzt gibt es TikTok, weitere kommen als neue Slots dazu.
import { zahl, vor, esc } from "../format.js";
import { zeitraum } from "../kennzahlen.js";
import { pfad } from "../diagramm-linie.js";
import { banner, xpBalken } from "./teile.js";

function miniVerlauf(punkte, jetzt) {
  const form = pfad(zeitraum(punkte, "1M", jetzt), 160, 40, 3);
  return form ? `<svg class="mini" viewBox="0 0 160 40" aria-hidden="true"><path d="${form.linie}"/></svg>` : "";
}

export const spielstaende = {
  zeichne(main, k) {
    const a = k.ansicht;
    const delta = a.seitGestern.aufrufe;
    const chip = delta === null ? "" : `<span class="chip ${delta > 0 ? "hoch" : delta < 0 ? "runter" : ""}">${delta > 0 ? "▲ +" : delta < 0 ? "▼ −" : "± "}${zahl(Math.abs(delta))} seit gestern</span>`;
    main.innerHTML = `<h1>Deine Spielstände</h1>${banner(a)}
      <div class="slots">
        <a class="slot panel" href="#/tiktok/heute">
          <div class="slot-kopf"><span class="leise">Spielstand 1</span><span class="abzeichen">Level ${a.level.level}</span></div>
          <h2>TikTok</h2>
          <p class="leise slot-unter">${esc(a.kanal ? `@${a.kanal}` : "Kanal")}</p>
          <div class="xp"></div>
          <div class="slot-zahl"><span class="wert">${zahl(a.aufrufeGesamt)}</span><span class="leise">Aufrufe</span>${chip}</div>
          ${miniVerlauf(a.verlauf.aufrufe, a.jetzt)}
          <p class="leise klein">${a.stand.cloud ? `Zahlen ${esc(vor(a.stand.cloud, a.jetzt))}` : "Noch keine Zahlen"}${a.serie ? `, Serie: ${a.serie} ${a.serie === 1 ? "Tag" : "Tage"}` : ""}</p>
        </a>
        <div class="slot frei"><span class="leise">Spielstand 2</span><p>Freier Platz für dein nächstes Projekt.</p></div>
      </div>`;
    xpBalken(main.querySelector(".xp"), a.level, a.profil?.follower ?? 0);
  },
};
