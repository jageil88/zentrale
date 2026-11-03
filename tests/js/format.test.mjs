import test from "node:test";
import assert from "node:assert/strict";
import { zahl, prozent, zeit, tag, vor, esc } from "../../docs/js/format.js";

test("esc entschärft HTML in Texten", () => {
  assert.equal(esc('<b>"Hi" & \'du\'</b>'), "&lt;b&gt;&quot;Hi&quot; &amp; &#39;du&#39;&lt;/b&gt;");
  assert.equal(esc(null), "");
});

test("deutsche Zahlen und Prozent", () => {
  assert.equal(zahl(1592), "1.592");
  assert.equal(zahl(null), "–");
  assert.equal(prozent(0.0672), "6,7 %");
  assert.equal(prozent(198), "19.800 %");
  assert.equal(prozent(0.5), "50,0 %");
});

test("Zeit und Tag", () => {
  assert.equal(zeit("2026-11-03T21:12:35"), "03.11. 21:12");
  assert.equal(tag("2026-11-03T21:12:35"), "03.11.2026");
});

test("vor: Minuten, Stunden, Tage", () => {
  const jetzt = new Date("2026-11-03T22:00:00");
  assert.equal(vor("2026-11-03T21:55:00", jetzt), "vor 5 Min.");
  assert.equal(vor("2026-11-03T19:00:00", jetzt), "vor 3 Std.");
  assert.equal(vor("2026-11-01T22:00:00", jetzt), "vor 2 Tagen");
  assert.equal(vor("2026-11-03T21:59:50", jetzt), "gerade eben");
});
