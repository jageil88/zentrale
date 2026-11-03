import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { schluesselAusPasswort, entschluesseln, pruefen } from "../../docs/js/krypto.js";

const vektor = JSON.parse(await readFile(new URL("../testvektor.json", import.meta.url), "utf8"));
const bytes = (s) => Uint8Array.from(Buffer.from(s, "base64"));

test("Testvektor aus Python wird im Browser-Code entschlüsselt", async () => {
  const key = await schluesselAusPasswort(vektor.passwort, vektor.salz, vektor.runden);
  const klar = await entschluesseln(key, bytes(vektor.daten).buffer);
  assert.equal(new TextDecoder().decode(klar), vektor.klartext);
});

test("falsches Passwort wird abgelehnt", async () => {
  const key = await schluesselAusPasswort("falsch", vektor.salz, vektor.runden);
  await assert.rejects(entschluesseln(key, bytes(vektor.daten).buffer), /falscher-schluessel/);
});

test("keine ZEN1-Datei wird abgelehnt", async () => {
  const key = await schluesselAusPasswort(vektor.passwort, vektor.salz, vektor.runden);
  await assert.rejects(entschluesseln(key, new TextEncoder().encode("<html>404</html>").buffer), /falscher-schluessel/);
});

test("pruefen erkennt richtigen und falschen Schlüssel", async () => {
  const richtig = await schluesselAusPasswort(vektor.passwort, vektor.salz, vektor.runden);
  const falsch = await schluesselAusPasswort("nein", vektor.salz, vektor.runden);
  assert.equal(await pruefen(richtig, vektor.pruef), true);
  assert.equal(await pruefen(falsch, vektor.pruef), false);
});
