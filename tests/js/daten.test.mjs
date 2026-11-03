import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { schluesselAusPasswort } from "../../docs/js/krypto.js";
import { modus, datenBasis, ladeOnline, ladePc } from "../../docs/js/daten.js";

const vektor = JSON.parse(await readFile(new URL("../testvektor.json", import.meta.url), "utf8"));
const bytes = (s) => Uint8Array.from(Buffer.from(s, "base64"));

async function verschluesseln(obj) {
  const key = await crypto.subtle.importKey("raw", bytes(vektor.schluessel), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return Uint8Array.from([...new TextEncoder().encode("ZEN1"), ...iv, ...ct]);
}

test("modus: 127.0.0.1 ist der PC, alles andere online", () => {
  assert.equal(modus({ hostname: "127.0.0.1" }), "pc");
  assert.equal(modus({ hostname: "jageil88.github.io" }), "online");
  assert.equal(modus({ hostname: "localhost" }), "online");
});

test("datenBasis: ?basis gilt nur auf localhost", () => {
  const roh = "https://raw.githubusercontent.com/jageil88/zentrale/";
  assert.equal(datenBasis({ hostname: "jageil88.github.io", search: "?basis=/boese/" }), roh);
  assert.equal(datenBasis({ hostname: "localhost", search: "?basis=/testdaten/" }), "/testdaten/");
  assert.equal(datenBasis({ hostname: "localhost", search: "" }), roh);
});

test("ladeOnline lädt beide Teile; fehlende Cloud-Datei ergibt null", async () => {
  const key = await schluesselAusPasswort(vektor.passwort, vektor.salz, vektor.runden);
  const pc = { v: 1, kanal: "testkanal", videos: [] };
  const dateien = { "/t/daten-tiktok-pc/tiktok-pc.enc": await verschluesseln(pc) };
  const fetchFn = async (url) => dateien[url] ? new Response(dateien[url]) : new Response("nicht da", { status: 404 });
  assert.deepEqual(await ladeOnline(key, fetchFn, "/t/"), { pc, cloud: null });
});

test("ladeOnline meldet Netzfehler statt leerer Daten", async () => {
  const key = await schluesselAusPasswort(vektor.passwort, vektor.salz, vektor.runden);
  const fetchFn = async () => new Response("kaputt", { status: 500 });
  await assert.rejects(ladeOnline(key, fetchFn, "/t/"), /netz/);
});

test("ladePc liest /api/daten", async () => {
  const fetchFn = async (url) => {
    assert.equal(url, "/api/daten");
    return Response.json({ modus: "pc", pc: { v: 1 }, cloud: null });
  };
  assert.deepEqual(await ladePc(fetchFn), { pc: { v: 1 }, cloud: null });
});
