// Lädt die Daten der Zentrale: online verschlüsselt von GitHub, am PC direkt von der lokalen Zentrale.
import { entschluesseln } from "./krypto.js";

const ROH = "https://raw.githubusercontent.com/jageil88/zentrale/";
export const QUELLEN = {
  pc: ["daten-tiktok-pc", "tiktok-pc.enc"],
  cloud: ["daten-tiktok-cloud", "tiktok-cloud.enc"],
};

export function modus(loc) {
  return loc.hostname === "127.0.0.1" ? "pc" : "online";
}

// ?basis= ersetzt die Datenquelle nur beim lokalen Testen, nie auf der echten Seite
export function datenBasis(loc) {
  if (loc.hostname === "localhost") {
    const basis = new URLSearchParams(loc.search || "").get("basis");
    if (basis) return basis;
  }
  return ROH;
}

async function holen(key, fetchFn, url) {
  const r = await fetchFn(url, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("netz");
  return entschluesseln(key, await r.arrayBuffer());
}

export async function ladeOnline(key, fetchFn, basis) {
  const teile = await Promise.all(Object.values(QUELLEN).map(async ([branch, datei]) => {
    const klar = await holen(key, fetchFn, `${basis}${branch}/${datei}`);
    return klar ? JSON.parse(new TextDecoder().decode(klar)) : null;
  }));
  return { pc: teile[0], cloud: teile[1] };
}

export async function ladePc(fetchFn) {
  const r = await fetchFn("/api/daten", { cache: "no-store" });
  if (!r.ok) throw new Error("netz");
  const d = await r.json();
  return { pc: d.pc ?? null, cloud: d.cloud ?? null };
}

export async function ladeDatei(key, fetchFn, basis, datei, typ) {
  const klar = await holen(key, fetchFn, `${basis}${QUELLEN.pc[0]}/${datei}`);
  return klar ? new Blob([klar], { type: typ }) : null;
}
