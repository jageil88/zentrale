// System: läuft alles? Automatik, TikTok, Budget, Datenstand – am PC dazu Einrichten und Zahlen holen.
import { ringMeter } from "../diagramm-kreis.js";
import { animationAn, animationSetzen } from "../aufbau.js";
import { zeit, tag, vor, geld, esc } from "../format.js";
import { banner, aktion } from "./teile.js";

const ONLINE = "https://jageil88.github.io/zentrale/";
const JOB = { profil: "Profil", videos: "Video-Zahlen" };
const GRUND = { budget: "Bremse: 4 $ erreicht", "kein Kanal": "Noch keine Daten vom PC", "kein APIFY_TOKEN": "Apify-Schlüssel fehlt" };

function abrufZeile(e) {
  const ergebnis = e.ok ? `ok, ${e.ergebnisse} Ergebnisse` : GRUND[e.grund] ?? e.grund ?? "fehlgeschlagen";
  return `<tr><td>${esc(zeit(e.zeit))}</td><td>${esc(JOB[e.job] ?? e.job)}</td><td>${esc(ergebnis)}</td></tr>`;
}

function entwurfZeile(e) {
  return `<tr><td>${esc(zeit(e.zeit))}</td><td>Video ${esc(e.nr)}</td><td>${e.ok ? "im Postfach" : esc(e.grund ?? "fehlgeschlagen")}</td></tr>`;
}

const EINRICHTEN = `<h2>Online-Zentrale einrichten</h2>
  <form class="panel einrichten" novalidate>
    <p>Wähle ein Passwort mit mindestens 8 Zeichen. Damit öffnest du deine Zentrale auf jedem Gerät.</p>
    <p class="leise klein">Merk es dir gut. Vergessen ist nicht schlimm: Hier am PC kannst du jederzeit ein neues festlegen.</p>
    <label for="pw1">Passwort</label><input id="pw1" type="password" autocomplete="new-password">
    <label class="abstand" for="pw2">Passwort wiederholen</label><input id="pw2" type="password" autocomplete="new-password">
    <p class="fehler" role="alert"></p>
    <button class="haupt" type="submit">Einrichten</button>
  </form>`;

export const system = {
  zeichne(main, k) {
    const a = k.ansicht;
    const lauf = a.laeufe[0];
    const pc = k.modus === "pc";
    main.innerHTML = `<h1>System</h1>${banner(a)}
      <div class="zwei">
        <section class="panel"><h3>Automatik</h3>
          <p>Letzter Video-Lauf: ${lauf ? `${esc(zeit(lauf.zeit))}, ${lauf.ok ? "fertig" : "abgebrochen"}${lauf.dauer_min ? ` nach ${lauf.dauer_min} Min.` : ""}` : "noch keiner"}</p>
          <p>Nächster Video-Lauf: ${a.naechsterLauf ? esc(zeit(a.naechsterLauf)) : "–"}</p>
          <p class="leise klein">Dafür muss der PC um 10 Uhr an sein.</p></section>
        <section class="panel"><h3>TikTok</h3>
          <p>${a.tiktok.verbunden ? `Verbunden bis ${esc(tag(a.tiktok.verbunden_bis))}. Der Zugang erneuert sich bei jedem Entwurf.` : "Nicht verbunden. Ohne Verbindung kommen keine Entwürfe in deine TikTok-App."}</p>
          ${pc ? `<a class="knopf" href="/tiktok/verbinden">${a.tiktok.verbunden ? "Neu verbinden" : "TikTok verbinden"}</a>` : ""}
          ${a.tiktok.entwuerfe?.length ? `<table class="liste"><tr><th>Zeit</th><th>Video</th><th>Ergebnis</th></tr>${a.tiktok.entwuerfe.map(entwurfZeile).join("")}</table>` : ""}
        </section>
        <section data-budget></section>
        <section class="panel"><h3>Datenstand</h3>
          <p>Zahlen aus der Cloud: ${a.stand.cloud ? esc(vor(a.stand.cloud, a.jetzt)) : "noch keine"}</p>
          <p>Daten vom PC: ${a.stand.pc ? esc(vor(a.stand.pc, a.jetzt)) : "noch keine"}</p>
          ${pc ? '<button type="button" data-aktualisieren>Zahlen jetzt holen</button>' : ""}
        </section>
        <section class="panel"><h3>Aufbau-Animation</h3>
          <p>Die Verläufe und Kreise bauen sich beim Ansehen in 4 Sekunden auf. Antippen überspringt sie.</p>
          <button type="button" data-animation>${animationAn() ? "Auf diesem Gerät ausschalten" : "Auf diesem Gerät einschalten"}</button>
        </section>
      </div>
      <h2>Letzte Abrufe</h2>
      ${a.abrufe.length ? `<div class="panel"><table class="liste"><tr><th>Zeit</th><th>Abruf</th><th>Ergebnis</th></tr>${a.abrufe.map(abrufZeile).join("")}</table></div>` : '<div class="leer">Noch keine Abrufe.</div>'}
      ${pc ? EINRICHTEN : ""}`;

    const usd = a.budget?.usd ?? 0;
    const grenze = a.budget?.limit ?? 4;
    ringMeter(main.querySelector("[data-budget]"), {
      titel: "Apify-Budget diesen Monat", wert: usd, max: grenze, text: geld(usd),
      unter: `von ${geld(grenze)}. Bei ${geld(grenze)} stoppt der Abruf bis zum Monatsersten, es kann nie Geld kosten.`,
    });
    main.querySelector("[data-animation]").addEventListener("click", (e) => {
      const an = !animationAn();
      animationSetzen(an);
      e.currentTarget.textContent = an ? "Auf diesem Gerät ausschalten" : "Auf diesem Gerät einschalten";
      k.meldung(an ? "Aufbau-Animation ist an" : "Aufbau-Animation ist aus");
    });
    if (!pc) return;

    main.querySelector("[data-aktualisieren]").addEventListener("click", async (e) => {
      const knopf = e.currentTarget;
      knopf.setAttribute("aria-busy", "true");
      try {
        await aktion("/api/aktualisieren");
        k.meldung("Cloud-Abruf gestartet. Neue Zahlen kommen in ein paar Minuten.");
      } catch (fehler) {
        k.meldung(fehler.message);
      } finally {
        knopf.removeAttribute("aria-busy");
      }
    });

    const form = main.querySelector(".einrichten");
    const fehler = form.querySelector(".fehler");
    form.addEventListener("input", () => { fehler.textContent = ""; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const knopf = form.querySelector("button");
      if (knopf.getAttribute("aria-busy") === "true") return;
      const pw1 = form.querySelector("#pw1").value;
      const pw2 = form.querySelector("#pw2").value;
      if (pw1.length < 8) { fehler.textContent = "Das Passwort braucht mindestens 8 Zeichen."; return; }
      if (pw1 !== pw2) { fehler.textContent = "Die beiden Passwörter sind nicht gleich."; return; }
      knopf.setAttribute("aria-busy", "true");
      knopf.textContent = "Wird eingerichtet …";
      try {
        await aktion("/api/online/einrichten", { passwort: pw1 });
        form.innerHTML = `<h3>Fertig</h3><p>Deine Zentrale ist online: <a href="${ONLINE}" target="_blank" rel="noopener">${ONLINE}</a></p>
          <p class="leise">Öffne den Link am Handy und gib einmal dein Passwort ein. Die ersten Zahlen aus der Cloud kommen in ein paar Minuten.</p>`;
      } catch (f) {
        knopf.removeAttribute("aria-busy");
        knopf.textContent = "Einrichten";
        fehler.textContent = f.message;
      }
    });
  },
};
