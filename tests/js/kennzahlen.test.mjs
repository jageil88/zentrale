import test from "node:test";
import assert from "node:assert/strict";
import {
  level, trend, seitGestern, zeitraum, serie, anteile, profilVerlauf, aufrufeVerlauf, videoTabelle, erfolge, ansicht,
} from "../../docs/js/kennzahlen.js";

const p = (zeit, wert) => ({ zeit: new Date(zeit), wert });
const STATS = [
  { zeit: "2026-11-02T10:00:00", art: "profil", follower: 0, likes: 10, videos: 1 },
  { zeit: "2026-11-02T10:00:00", art: "video", video_id: "1", aufrufe: 100, likes: 5, kommentare: 0, shares: 0, titel: "A", erstellt: "2026-11-02T01:00:00Z" },
  { zeit: "2026-11-03T10:00:00", art: "profil", follower: 2, likes: 112, videos: 3 },
  { zeit: "2026-11-03T10:00:00", art: "video", video_id: "1", aufrufe: 650, likes: 22, kommentare: 0, shares: 1, titel: "A", erstellt: "2026-11-02T01:00:00Z" },
  { zeit: "2026-11-03T10:00:00", art: "video", video_id: "2", aufrufe: 942, likes: 85, kommentare: 1, shares: 0, titel: "B", erstellt: "2026-11-02T13:00:00Z" },
];

test("level: Schwellen und Fortschritt", () => {
  assert.deepEqual(level(2), { level: 1, von: 0, bis: 10, fortschritt: 0.2 });
  assert.deepEqual(level(10), { level: 2, von: 10, bis: 25, fortschritt: 0 });
  assert.deepEqual(level(60000), { level: 13, von: 50000, bis: null, fortschritt: 1 });
  assert.equal(level(null).level, 1);
});

test("trend: hoch, runter, gleich", () => {
  assert.equal(trend([p("2026-11-01", 5), p("2026-11-02", 9)]).richtung, "hoch");
  assert.equal(trend([p("2026-11-01", 9), p("2026-11-02", 5)]).richtung, "runter");
  const flach = trend([p("2026-11-01", 5), p("2026-11-02", 5)]);
  assert.equal(flach.richtung, "gleich");
  assert.equal(flach.diff, 0);
  assert.equal(trend([p("2026-11-01", 0), p("2026-11-02", 4)]).prozent, null);
  assert.equal(trend([]).richtung, "gleich");
});

test("seitGestern braucht eine mindestens 24 h alte Messung", () => {
  const punkte = [p("2026-11-02T10:00:00", 10), p("2026-11-03T10:00:00", 112)];
  assert.equal(seitGestern(punkte, new Date("2026-11-03T11:00:00")), 102);
  assert.equal(seitGestern(punkte, new Date("2026-11-03T09:59:00")), null);
});

test("zeitraum schneidet und setzt den Startwert an den Anfang", () => {
  const punkte = [p("2026-10-01T10:00:00", 1), p("2026-11-01T10:00:00", 5), p("2026-11-03T10:00:00", 8)];
  const jetzt = new Date("2026-11-03T12:00:00");
  const woche = zeitraum(punkte, "1W", jetzt);
  assert.equal(woche.length, 3);
  assert.equal(woche[0].wert, 1);
  assert.equal(+woche[0].zeit, +new Date("2026-10-27T12:00:00"));
  assert.equal(zeitraum(punkte, "Alles", jetzt).length, 3);
  assert.deepEqual(zeitraum([p("2026-11-03T11:00:00", 3)], "1T", jetzt).map((x) => x.wert), [3]);
});

test("serie zählt Berliner Kalendertage am Stück", () => {
  const v = (h) => ({ status: "hochgeladen", tiktok: { hochgeladen: h } });
  const videos = [v("2026-11-01T18:00:00"), v("2026-11-02T14:49:48"), v("2026-11-03T17:17:54")];
  assert.equal(serie(videos, new Date("2026-11-04T10:00:00")), 3);
  assert.equal(serie(videos, new Date("2026-11-03T20:00:00")), 3);
  assert.equal(serie(videos.slice(0, 2), new Date("2026-11-04T10:00:00")), 0);
  assert.equal(serie([], new Date()), 0);
});

test("anteile faltet in Top 4 plus Rest", () => {
  const e = [6, 5, 4, 3, 2, 1].map((w, i) => ({ name: `V${i}`, wert: w }));
  const a = anteile(e);
  assert.deepEqual(a.map((x) => x.name), ["V0", "V1", "V2", "V3", "Rest"]);
  assert.equal(a[4].wert, 3);
  assert.ok(Math.abs(a.reduce((s, x) => s + x.anteil, 0) - 1) < 1e-9);
  assert.deepEqual(anteile([{ name: "x", wert: 0 }]), []);
});

test("Verläufe und Video-Tabelle aus den Rohzeilen", () => {
  assert.deepEqual(profilVerlauf(STATS).map((x) => x.follower), [0, 2]);
  assert.deepEqual(aufrufeVerlauf(STATS).map((x) => x.wert), [100, 1592]);
  const t = videoTabelle(STATS);
  assert.deepEqual(t.map((x) => x.video_id), ["2", "1"]);
  assert.equal(t[1].aufrufe, 650);
  assert.deepEqual(t[1].verlauf.map((x) => x.wert), [100, 650]);
});

test("erfolge aus der Ansicht", () => {
  const e = erfolge({ videos: [{ status: "hochgeladen" }], aufrufeGesamt: 1592, tabelle: videoTabelle(STATS), profil: { follower: 2 }, serie: 3 });
  const an = Object.fromEntries(e.map((x) => [x.id, x.erreicht]));
  assert.equal(an["aufrufe-1000"], true);
  assert.equal(an["aufrufe-10000"], false);
  assert.equal(an["video-500"], true);
  assert.equal(an["kommentar-1"], true);
  assert.equal(an["follower-10"], false);
  assert.equal(an["serie-3"], true);
});

test("ansicht führt PC und Cloud zusammen, auch wenn einer fehlt", () => {
  const pc = { kanal: "k", stand: "2026-11-03T21:00:00", videos: [
    { nr: 3, titel: "C", status: "fertig", art: "geschichte", beschreibung: "x", tiktok: { video_id: null } },
    { nr: 2, titel: "B", status: "hochgeladen", art: "geschichte", tiktok: { video_id: "2", hochgeladen: "2026-11-02T14:49:48" } },
    { nr: 1, titel: "A", status: "hochgeladen", art: "zeitlos", tiktok: { video_id: "1", hochgeladen: "2026-11-02T02:33:23" } },
  ] };
  const cloud = { stand: "2026-11-03T10:00:00", stats: STATS, abrufe: [], budget: { monat: "2026-11", usd: 0.042, limit: 4 },
    zuordnung: { 3: { video_id: "9", link: "L9", hochgeladen: "2026-11-03T17:17:54" } } };
  const a = ansicht({ pc, cloud }, new Date("2026-11-03T22:00:00"));
  assert.equal(a.videos.find((v) => v.nr === 3).tiktok.video_id, "9");
  assert.equal(a.videos.find((v) => v.nr === 2).zahlen.aufrufe, 942);
  assert.equal(a.aufrufeGesamt, 1592);
  assert.deepEqual(a.arten.map((x) => x.name), ["geschichte", "zeitlos"]);
  assert.equal(a.level.level, 1);
  assert.equal(a.alt.cloud, true);
  assert.equal(a.alt.pc, false);
  assert.doesNotThrow(() => ansicht({ pc: null, cloud: null }, new Date()));
  assert.doesNotThrow(() => ansicht({ pc, cloud: null }, new Date()));
});
