import test from "node:test";
import assert from "node:assert/strict";
import { easeOut } from "../../docs/js/aufbau.js";
import { skala, pfad, naechster, kopfBei } from "../../docs/js/diagramm-linie.js";
import { segmente } from "../../docs/js/diagramm-kreis.js";

const p = (zeit, wert) => ({ zeit: new Date(zeit), wert });

test("easeOut beginnt bei 0, endet bei 1 und steigt", () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  let vorher = -1;
  for (let i = 0; i <= 20; i += 1) {
    const w = easeOut(i / 20);
    assert.ok(w >= vorher);
    vorher = w;
  }
});

test("skala bildet min und max auf die Ränder ab, flach auf die Mitte", () => {
  const y = skala(0, 10, 100, 10);
  assert.equal(y(10), 10);
  assert.equal(y(0), 90);
  assert.equal(skala(5, 5, 100, 10)(5), 50);
});

test("pfad: flache Daten ergeben eine waagerechte Linie ohne NaN", () => {
  const r = pfad([p("2026-11-01", 5), p("2026-11-02", 5), p("2026-11-03", 5)], 300, 100);
  assert.ok(!r.linie.includes("NaN"));
  assert.ok(r.xy.every(([, y]) => y === r.xy[0][1]));
  assert.equal(r.xy[0][0] < r.xy[2][0], true);
  assert.equal(pfad([p("2026-11-01", 5)], 300, 100), null);
});

test("naechster findet den Punkt mit dem nächsten x", () => {
  assert.equal(naechster([[0, 0], [50, 0], [100, 0]], 60), 1);
  assert.equal(naechster([[0, 0], [50, 0], [100, 0]], 99), 2);
});

test("kopfBei interpoliert die Höhe an der Zeichen-Spitze", () => {
  assert.deepEqual(kopfBei([[0, 100], [100, 0]], 50), [50, 50]);
  assert.deepEqual(kopfBei([[0, 100], [100, 0]], 200), [100, 0]);
});

test("segmente: Lücken zwischen Teilen, Aufbau mit Fortschritt", () => {
  const umfang = 100;
  const s = segmente([0.5, 0.5], umfang, 2, 1);
  assert.deepEqual(s.map((x) => [x.start, x.laenge]), [[0, 48], [50, 48]]);
  const halb = segmente([0.5, 0.5], umfang, 2, 0.5);
  assert.deepEqual(halb.map((x) => x.laenge), [48, 0]);
  assert.deepEqual(segmente([1], umfang, 2, 1).map((x) => x.laenge), [100]);
});
