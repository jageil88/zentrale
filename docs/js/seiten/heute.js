// Heute: das aktuelle Video, was jetzt zu tun ist, Text kopieren und MP4 speichern.
import { zahl, esc } from "../format.js";
import { STATUS, banner, aktion, dateiUrl, nurAmPc } from "./teile.js";

const ART = { geschichte: "Geschichte", aktuell: "Aktuell", zeitlos: "Zeitlos" };
const ENTWURF_STUNDE = 14;

function bisEntwurf(jetzt) {
  const ziel = new Date(jetzt);
  ziel.setHours(ENTWURF_STUNDE, 0, 0, 0);
  const min = Math.round((ziel - jetzt) / 60000);
  if (min <= 0) return null;
  return min >= 60 ? `Noch ${Math.floor(min / 60)} Std. ${min % 60} Min.` : `Noch ${min} Min.`;
}

function textZumEinfuegen(v) {
  const tags = (v.hashtags ?? []).map((h) => (String(h).startsWith("#") ? h : `#${h}`)).join(" ");
  return [v.beschreibung ?? "", tags].filter(Boolean).join("\n\n");
}

function naechsterSchritt(v, a) {
  if (v.status === "entwurf") {
    return `<h3>Liegt in deinem TikTok-Postfach</h3>
      <ol><li>TikTok öffnen und den Entwurf antippen.</li><li>Den Text einfügen („Text kopieren“).</li>
      <li>Wenn du willst, einen Sound drüberlegen, dann posten.</li></ol>
      <p class="leise klein">Link und Zahlen trägt die Zentrale danach selbst ein.</p>`;
  }
  if (v.status === "hochgeladen") {
    const zahlen = v.zahlen ? `${zahl(v.zahlen.aufrufe)} Aufrufe und ${zahl(v.zahlen.likes)} Likes bis jetzt.` : "Die ersten Zahlen kommen mit dem nächsten Abruf.";
    const link = v.tiktok?.link ? `<a class="knopf" href="${esc(v.tiktok.link)}" target="_blank" rel="noopener noreferrer">Auf TikTok ansehen</a>` : "";
    return `<h3>Ist online</h3><p>${zahlen}</p>${link}`;
  }
  if (v.status === "fertig" && a.tiktok.verbunden) {
    const rest = bisEntwurf(a.jetzt);
    return `<h3>Geht um 14 Uhr als Entwurf an TikTok</h3>
      <p>${rest ? `${rest}. ` : ""}Dann kommt eine Benachrichtigung in deiner TikTok-App.</p>`;
  }
  if (v.status === "fertig") {
    return `<h3>Heute selbst posten</h3>
      <ol><li>„MP4 speichern“ tippen.</li><li>„Text kopieren“ tippen.</li><li>In TikTok das Video hochladen, Text einfügen, posten.</li></ol>
      <p class="leise klein">TikTok ist noch nicht verbunden, darum kommt kein Entwurf.</p>`;
  }
  return `<h3>${esc(STATUS[v.status] ?? v.status)}</h3>`;
}

function quelle(q) {
  const url = typeof q === "string" ? q : q?.url;
  const name = typeof q === "string" ? q : q?.titel || q?.name || url;
  return /^https?:\/\//.test(url ?? "") ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>` : esc(name);
}

function pcKnoepfe(v, a) {
  const schicken = v.status === "fertig" && a.tiktok.verbunden ? '<button type="button" data-entwurf>Jetzt an TikTok schicken</button>' : "";
  const markieren = v.status !== "hochgeladen" ? '<button type="button" data-markieren>Als gepostet markieren</button>' : "";
  return `<div class="knoepfe">${schicken}${markieren}</div>
    <form class="panel feedback"><h3>Wie findest du das Video?</h3>
      <div class="knoepfe"><button type="button" data-daumen="hoch" aria-pressed="false">Daumen hoch</button><button type="button" data-daumen="runter" aria-pressed="false">Daumen runter</button></div>
      <label for="fb-text">Was soll beim nächsten Video anders sein?</label>
      <textarea id="fb-text" rows="3"></textarea>
      <div class="knoepfe"><button class="haupt" type="submit">Feedback speichern</button></div>
    </form>`;
}

export const heute = {
  zeichne(main, k) {
    const a = k.ansicht;
    const v = a.heute;
    if (!v) {
      main.innerHTML = `<h1>Heute</h1>${banner(a)}<div class="leer">Um 10 Uhr baut der PC das nächste Video.</div>`;
      return;
    }
    const nr = String(v.nr).padStart(2, "0");
    main.innerHTML = `<h1>Heute</h1>${banner(a)}
      <div class="heute">
        <div class="spieler-rahmen"><div class="spieler-platz leise">Video wird geladen …</div></div>
        <div>
          <p class="leise">Video ${v.nr}${v.art ? `, ${esc(ART[v.art] ?? v.art)}` : ""}${v.dauer_s ? `, ${v.dauer_s} s` : ""}</p>
          <h2 class="titel">${esc(v.titel)}</h2>
          <span class="status ${esc(v.status)}">${esc(STATUS[v.status] ?? v.status)}</span>
          <div class="panel schritt">${naechsterSchritt(v, a)}</div>
          <div class="knoepfe"><button class="haupt" type="button" data-kopieren>Text kopieren</button>
            <a class="knopf" data-mp4 hidden download="durchgespielt-${nr}.mp4">MP4 speichern</a></div>
          ${k.modus === "pc" ? pcKnoepfe(v, a) : nurAmPc}
          <div class="panel"><h3>Text zum Einfügen</h3><p class="beschreibung">${esc(textZumEinfuegen(v))}</p></div>
          ${v.quellen?.length ? `<details class="panel"><summary>Quellen</summary><ul>${v.quellen.map((q) => `<li>${quelle(q)}</li>`).join("")}</ul></details>` : ""}
        </div>
      </div>`;

    const platz = main.querySelector(".spieler-rahmen");
    const mp4 = main.querySelector("[data-mp4]");
    Promise.all([dateiUrl(k, v, "video"), dateiUrl(k, v, "vorschau")]).then(([video, bild]) => {
      if (!main.contains(platz)) return;
      if (video) {
        platz.innerHTML = `<video class="spieler" controls playsinline preload="metadata"${bild ? ` poster="${bild}"` : ""} src="${video}"></video>`;
        mp4.href = video;
        mp4.hidden = false;
      } else if (v.tiktok?.link) {
        platz.innerHTML = `<div class="spieler-platz"><a class="knopf" href="${esc(v.tiktok.link)}" target="_blank" rel="noopener noreferrer">Auf TikTok ansehen</a></div>`;
      } else {
        platz.innerHTML = '<div class="spieler-platz leise">Das Video liegt nur am PC.</div>';
      }
    });

    main.querySelector("[data-kopieren]").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textZumEinfuegen(v));
        k.meldung("Text kopiert");
      } catch {
        k.meldung("Kopieren ging nicht. Markier den Text unten von Hand.");
      }
    });

    if (k.modus !== "pc") return;
    const knopfAktion = async (knopf, pfad, body, erfolg) => {
      knopf.setAttribute("aria-busy", "true");
      try {
        const r = await aktion(pfad, body);
        k.meldung(typeof erfolg === "function" ? erfolg(r) : erfolg);
        k.neuLaden();
      } catch (e) {
        k.meldung(e.message);
      } finally {
        knopf.removeAttribute("aria-busy");
      }
    };
    main.querySelector("[data-entwurf]")?.addEventListener("click", (e) => knopfAktion(e.currentTarget, "/api/tiktok/entwurf", { nr: v.nr },
      (r) => (r.ok ? "Entwurf ist unterwegs in deine TikTok-App" : `Ging nicht: ${r.grund ?? "unbekannt"}`)));
    main.querySelector("[data-markieren]")?.addEventListener("click", (e) => knopfAktion(e.currentTarget,
      `/api/videos/${v.nr}/status`, { status: "hochgeladen", link: null }, "Als gepostet markiert"));
    const form = main.querySelector(".feedback");
    let daumen = null;
    form.querySelectorAll("[data-daumen]").forEach((b) => b.addEventListener("click", () => {
      daumen = b.dataset.daumen;
      form.querySelectorAll("[data-daumen]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      knopfAktion(form.querySelector('[type="submit"]'), "/api/feedback",
        { nr: v.nr, daumen, text: form.querySelector("textarea").value.trim() }, "Feedback gespeichert, es fließt ins nächste Video ein");
    });
  },
};
