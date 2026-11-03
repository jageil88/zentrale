// Videos: alle als Karten, die meistgesehenen zuerst.
import { zahl, esc } from "../format.js";
import { STATUS, banner, dateiUrl } from "./teile.js";

function karte(v) {
  const link = v.tiktok?.link ? `<a href="${esc(v.tiktok.link)}" target="_blank" rel="noopener noreferrer">Auf TikTok</a>` : "";
  const werte = v.zahlen
    ? `<p class="werte"><span class="wert">${zahl(v.zahlen.aufrufe)}</span> Aufrufe <span class="wert">${zahl(v.zahlen.likes)}</span> Likes</p>`
    : '<p class="werte leise">Noch keine Zahlen</p>';
  return `<article class="karte panel" data-nr="${v.nr}">
    <div class="bild"><span class="nr">Nr. ${v.nr}</span></div>
    <div class="info"><span class="status ${esc(v.status)}">${esc(STATUS[v.status] ?? v.status)}</span>
      <h3>${esc(v.titel)}</h3>${werte}${link}</div></article>`;
}

export const videos = {
  zeichne(main, k) {
    const a = k.ansicht;
    const liste = [...a.videos].sort((x, y) => (y.zahlen?.aufrufe ?? -1) - (x.zahlen?.aufrufe ?? -1) || y.nr - x.nr);
    if (!liste.length) {
      main.innerHTML = `<h1>Videos</h1>${banner(a)}<div class="leer">Noch keine Videos. Das erste baut der PC um 10 Uhr.</div>`;
      return;
    }
    main.innerHTML = `<h1>Videos</h1>${banner(a)}<div class="karten">${liste.map(karte).join("")}</div>`;
    for (const v of liste) {
      dateiUrl(k, v, "vorschau").then((url) => {
        const bild = main.querySelector(`.karte[data-nr="${v.nr}"] .bild`);
        if (url && bild) bild.insertAdjacentHTML("afterbegin", `<img src="${url}" alt="" loading="lazy">`);
      });
    }
  },
};
