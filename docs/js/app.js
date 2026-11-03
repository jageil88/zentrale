// Steuerung der Zentrale: Passwort, Laden, Seitenwechsel.
// Pro Bildschirm gilt genau ein Zustand: passwort, laden, fehler oder inhalt.
import { modus, datenBasis, ladeOnline, ladePc } from "./daten.js";
import { schluesselAusPasswort, pruefen } from "./krypto.js";
import { merken, holen, vergessen } from "./schluessel-speicher.js";
import { esc } from "./format.js";
import { SEITEN, NAV, ansichtBauen } from "./seiten/index.js";

const main = document.getElementById("inhalt");
const nav = document.querySelector(".nav");
const rechts = document.querySelector(".kopf .rechts");
const meldungEl = document.querySelector(".meldung");
const AKTUALISIEREN_MS = 5 * 60 * 1000;

const k = { modus: modus(location), basis: datenBasis(location), key: null, roh: null, ansicht: null, geladen: null };
k.meldung = meldung;
k.neuLaden = () => laden({ still: true });

function meldung(text) {
  meldungEl.textContent = text;
  clearTimeout(meldung.uhr);
  meldung.uhr = setTimeout(() => { meldungEl.textContent = ""; }, 5000);
}

const schluesselUrl = () => (k.basis.startsWith("http") ? "schluessel.json" : `${k.basis}schluessel.json`);
const route = () => { const h = location.hash.replace(/^#\/?/, ""); return h in SEITEN ? h : ""; };

function navZeigen(sichtbar) {
  nav.hidden = !sichtbar;
  if (!sichtbar) return;
  const aktiv = route();
  nav.innerHTML = NAV.map((n) => `<a href="#/${n.ziel}"${n.ziel === aktiv ? ' aria-current="page"' : ""}>${esc(n.text)}</a>`).join("");
  rechts.innerHTML = k.modus === "online" && k.key ? '<button class="leise-knopf" type="button" data-abmelden>Abmelden</button>' : "";
}

function zeigeGeruest() {
  main.innerHTML = '<div class="geruest" aria-label="Lädt"><div class="gross"></div><div></div><div></div></div>';
}

function zeigeFehler(text) {
  navZeigen(false);
  main.innerHTML = `<section class="panel"><h2>Das hat nicht geklappt</h2><p>${esc(text)}</p>
    <div class="knoepfe"><button class="haupt" type="button" data-nochmal>Nochmal laden</button></div></section>`;
}

function zeigeNichtEingerichtet() {
  navZeigen(false);
  main.innerHTML = `<section class="tor"><h1>Zentrale</h1><div class="panel">
    <p>Die Online-Zentrale ist noch nicht eingerichtet.</p>
    <p class="leise">Öffne die Zentrale an deinem PC und richte sie unter System ein. Danach geht sie hier.</p></div></section>`;
}

async function zeigePasswort(hinweis = "") {
  navZeigen(false);
  let einstellung;
  try {
    const r = await fetch(schluesselUrl(), { cache: "no-store" });
    if (r.status === 404) return zeigeNichtEingerichtet();
    if (!r.ok) throw new Error("netz");
    einstellung = await r.json();
  } catch {
    return zeigeFehler("Die Zentrale ist gerade nicht erreichbar. Prüf deine Internetverbindung.");
  }
  main.innerHTML = `<section class="tor">
    <h1>Zentrale</h1>
    <form class="panel" novalidate>
      <p class="leise">Gib dein Passwort ein, um deinen Spielstand zu laden.</p>
      <label for="pw">Passwort</label>
      <input id="pw" type="password" autocomplete="current-password" required>
      <label class="haken"><input type="checkbox" checked> Auf diesem Gerät angemeldet bleiben</label>
      <p class="fehler" role="alert">${esc(hinweis)}</p>
      <button class="haupt" type="submit">Entsperren</button>
    </form></section>`;
  const form = main.querySelector("form");
  const feld = form.querySelector("#pw");
  const fehler = form.querySelector(".fehler");
  const knopf = form.querySelector("button");
  feld.focus();
  feld.addEventListener("input", () => { fehler.textContent = ""; });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (knopf.getAttribute("aria-busy") === "true") return;
    if (!feld.value) { fehler.textContent = "Gib erst dein Passwort ein."; return; }
    knopf.setAttribute("aria-busy", "true");
    knopf.textContent = "Wird entsperrt …";
    const key = await schluesselAusPasswort(feld.value, einstellung.salz, einstellung.runden);
    if (!(await pruefen(key, einstellung.pruef))) {
      knopf.removeAttribute("aria-busy");
      knopf.textContent = "Entsperren";
      fehler.textContent = "Das Passwort passt nicht. Versuch es nochmal.";
      feld.select();
      return;
    }
    k.key = key;
    if (form.querySelector('input[type="checkbox"]').checked) await merken(key);
    laden();
  });
}

async function laden({ still = false } = {}) {
  const uhr = still ? null : setTimeout(zeigeGeruest, 200);
  try {
    k.roh = k.modus === "pc" ? await ladePc(fetch) : await ladeOnline(k.key, fetch, k.basis);
    k.geladen = new Date();
  } catch (e) {
    clearTimeout(uhr);
    if (e.message === "falscher-schluessel") {
      await vergessen();
      k.key = null;
      return zeigePasswort("Dein Passwort wurde geändert. Gib das neue ein.");
    }
    if (still && k.roh) return meldung("Neue Daten konnten gerade nicht geladen werden.");
    return zeigeFehler("Die Daten konnten nicht geladen werden. Prüf deine Internetverbindung.");
  }
  clearTimeout(uhr);
  zeichne();
}

function zeichne() {
  if (!k.roh) return;
  k.ansicht = ansichtBauen(k.roh, new Date());
  navZeigen(true);
  SEITEN[route()].zeichne(main, k);
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-nochmal]")) laden();
  if (e.target.closest("[data-abmelden]")) {
    vergessen();
    k.key = null;
    zeigePasswort();
  }
});

window.addEventListener("hashchange", () => {
  if (!k.roh) return;
  zeichne();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});

setInterval(() => { if (k.roh && document.visibilityState === "visible") laden({ still: true }); }, AKTUALISIEREN_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && k.roh && Date.now() - k.geladen > AKTUALISIEREN_MS) laden({ still: true });
});

async function start() {
  if (k.modus === "pc") return laden();
  k.key = await holen();
  return k.key ? laden() : zeigePasswort();
}

start();
