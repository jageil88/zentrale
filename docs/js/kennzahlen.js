// Rechnet aus den Rohdaten (PC + Cloud) alles aus, was die Seiten zeigen: Verläufe, Level, Erfolge, Serie.
// Zeiten in den Daten sind Berliner Ortszeit ohne Zone (so schreibt sie der PC und die Cloud).
const SCHWELLEN = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const STUNDE = 3600 * 1000;
const DAUER = { "1T": 24 * STUNDE, "1W": 7 * 24 * STUNDE, "1M": 30 * 24 * STUNDE };

const datum = (iso) => new Date(iso);
const nachZeit = (a, b) => a.zeit - b.zeit;

export function level(follower) {
  const f = follower ?? 0;
  const erreicht = SCHWELLEN.filter((s) => s <= f).length;
  const von = erreicht ? SCHWELLEN[erreicht - 1] : 0;
  const bis = SCHWELLEN[erreicht] ?? null;
  const fortschritt = bis === null ? 1 : Math.min(1, Math.max(0, (f - von) / (bis - von)));
  return { level: erreicht + 1, von, bis, fortschritt };
}

export function trend(punkte) {
  if (!punkte.length) return { start: null, ende: null, diff: 0, prozent: null, richtung: "gleich" };
  const start = punkte[0].wert ?? 0;
  const ende = punkte[punkte.length - 1].wert ?? 0;
  const diff = ende - start;
  return { start, ende, diff, prozent: start > 0 ? diff / start : null, richtung: diff > 0 ? "hoch" : diff < 0 ? "runter" : "gleich" };
}

export function seitGestern(punkte, jetzt) {
  const bisJetzt = punkte.filter((x) => x.zeit <= jetzt);
  const alt = punkte.filter((x) => x.zeit <= jetzt - 24 * STUNDE);
  if (!bisJetzt.length || !alt.length) return null;
  return (bisJetzt[bisJetzt.length - 1].wert ?? 0) - (alt[alt.length - 1].wert ?? 0);
}

// Punkte im Zeitraum; der letzte Wert davor wird als Startpunkt an den Anfang gesetzt,
// damit die Änderung über den ganzen Zeitraum stimmt.
export function zeitraum(punkte, name, jetzt) {
  if (!(name in DAUER)) return [...punkte];
  const start = new Date(jetzt - DAUER[name]);
  const drin = punkte.filter((x) => x.zeit >= start && x.zeit <= jetzt);
  const vorher = punkte.filter((x) => x.zeit < start).pop();
  return vorher ? [{ zeit: start, wert: vorher.wert }, ...drin] : drin;
}

const tagBerlin = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
const tagDavor = (schluessel) => {
  const d = new Date(`${schluessel}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function serie(videos, jetzt) {
  const tage = new Set(videos.map((v) => v?.tiktok?.hochgeladen?.slice(0, 10)).filter(Boolean));
  let tag = tagBerlin(jetzt);
  if (!tage.has(tag)) tag = tagDavor(tag);
  let n = 0;
  while (tage.has(tag)) { n += 1; tag = tagDavor(tag); }
  return n;
}

export function anteile(eintraege, max = 5) {
  const sortiert = eintraege.filter((e) => e.wert > 0).sort((a, b) => b.wert - a.wert);
  const teile = sortiert.length > max
    ? [...sortiert.slice(0, max - 1), { name: "Rest", wert: sortiert.slice(max - 1).reduce((s, e) => s + e.wert, 0) }]
    : sortiert;
  const summe = teile.reduce((s, e) => s + e.wert, 0);
  return teile.map((e) => ({ ...e, anteil: summe ? e.wert / summe : 0 }));
}

export function profilVerlauf(stats) {
  return stats.filter((z) => z.art === "profil")
    .map((z) => ({ zeit: datum(z.zeit), follower: z.follower, likes: z.likes, videos: z.videos }))
    .sort(nachZeit);
}

const videoZeilen = (stats) => stats.filter((z) => z.art === "video").map((z) => ({ ...z, zeit: datum(z.zeit) })).sort(nachZeit);

export function aufrufeVerlauf(stats) {
  const stand = new Map();
  const punkte = [];
  for (const z of videoZeilen(stats)) {
    stand.set(z.video_id, z.aufrufe ?? 0);
    const wert = [...stand.values()].reduce((s, a) => s + a, 0);
    const letzter = punkte[punkte.length - 1];
    if (letzter && +letzter.zeit === +z.zeit) letzter.wert = wert;
    else punkte.push({ zeit: z.zeit, wert });
  }
  return punkte;
}

export function videoTabelle(stats) {
  const proVideo = new Map();
  for (const z of videoZeilen(stats)) {
    if (!proVideo.has(z.video_id)) proVideo.set(z.video_id, []);
    proVideo.get(z.video_id).push(z);
  }
  return [...proVideo.values()].map((zeilen) => {
    const z = zeilen[zeilen.length - 1];
    const aufrufe = z.aufrufe ?? 0;
    const reaktionen = (z.likes ?? 0) + (z.kommentare ?? 0) + (z.shares ?? 0);
    return {
      video_id: z.video_id, titel: z.titel, erstellt: z.erstellt, link: z.link,
      aufrufe, likes: z.likes ?? 0, kommentare: z.kommentare ?? 0, shares: z.shares ?? 0,
      interaktion: aufrufe ? reaktionen / aufrufe : 0,
      verlauf: zeilen.map((x) => ({ zeit: x.zeit, wert: x.aufrufe ?? 0 })),
    };
  }).sort((a, b) => b.aufrufe - a.aufrufe);
}

export function erfolge(a) {
  const tabelle = a.tabelle ?? [];
  const maxVon = (feld) => tabelle.reduce((m, v) => Math.max(m, v[feld] ?? 0), 0);
  const gepostet = (a.videos ?? []).filter((v) => v.status === "hochgeladen").length;
  const follower = a.profil?.follower ?? 0;
  const liste = [
    ["erstes-video", "Erstes Video gepostet", gepostet >= 1],
    ["aufrufe-100", "100 Aufrufe", a.aufrufeGesamt >= 100],
    ["aufrufe-1000", "1.000 Aufrufe", a.aufrufeGesamt >= 1000],
    ["aufrufe-10000", "10.000 Aufrufe", a.aufrufeGesamt >= 10000],
    ["video-500", "Ein Video mit 500 Aufrufen", maxVon("aufrufe") >= 500],
    ["video-1000", "Ein Video mit 1.000 Aufrufen", maxVon("aufrufe") >= 1000],
    ["likes-100", "100 Likes auf einem Video", maxVon("likes") >= 100],
    ["kommentar-1", "Erster Kommentar", maxVon("kommentare") >= 1],
    ["follower-10", "10 Follower", follower >= 10],
    ["follower-100", "100 Follower", follower >= 100],
    ["follower-1000", "1.000 Follower", follower >= 1000],
    ["serie-3", "3 Tage am Stück gepostet", (a.serie ?? 0) >= 3],
    ["serie-7", "7 Tage am Stück gepostet", (a.serie ?? 0) >= 7],
  ];
  return liste.map(([id, name, erreicht]) => ({ id, name, erreicht: Boolean(erreicht) }));
}

const alterStunden = (iso, jetzt) => (iso ? (jetzt - datum(iso)) / STUNDE : Infinity);

export function ansicht(roh, jetzt) {
  const pc = roh?.pc ?? null;
  const cloud = roh?.cloud ?? null;
  const stats = cloud?.stats ?? [];
  const zuordnung = cloud?.zuordnung ?? {};
  const tabelle = videoTabelle(stats);
  const zahlenVon = new Map(tabelle.map((t) => [t.video_id, t]));

  const videos = (pc?.videos ?? []).map((v) => {
    const extra = !v.tiktok?.video_id && zuordnung[v.nr];
    const tiktok = extra ? { ...v.tiktok, ...extra } : { ...v.tiktok };
    const status = extra ? "hochgeladen" : v.status;
    return { ...v, status, tiktok, zahlen: zahlenVon.get(tiktok.video_id) ?? null };
  }).sort((a, b) => b.nr - a.nr);

  const profile = profilVerlauf(stats);
  const verlauf = {
    follower: profile.map((x) => ({ zeit: x.zeit, wert: x.follower })),
    likes: profile.map((x) => ({ zeit: x.zeit, wert: x.likes })),
    aufrufe: aufrufeVerlauf(stats),
  };
  const nachArt = new Map();
  for (const v of videos) {
    if (v.zahlen && v.art) nachArt.set(v.art, (nachArt.get(v.art) ?? 0) + v.zahlen.aufrufe);
  }
  const aufrufeGesamt = tabelle.reduce((s, t) => s + t.aufrufe, 0);
  const likesGesamt = tabelle.reduce((s, t) => s + t.likes, 0);
  const profil = profile[profile.length - 1] ?? null;

  const a = {
    jetzt,
    kanal: pc?.kanal ?? null,
    videos,
    heute: videos.find((v) => v.status === "fertig" || v.status === "entwurf") ?? videos[0] ?? null,
    profil,
    verlauf,
    seitGestern: {
      follower: seitGestern(verlauf.follower, jetzt),
      likes: seitGestern(verlauf.likes, jetzt),
      aufrufe: seitGestern(verlauf.aufrufe, jetzt),
    },
    tabelle,
    aufrufeGesamt,
    likeQuote: aufrufeGesamt ? likesGesamt / aufrufeGesamt : null,
    arten: anteile([...nachArt].map(([name, wert]) => ({ name, wert }))),
    level: level(profil?.follower),
    serie: serie(videos.filter((v) => v.status === "hochgeladen"), jetzt),
    neu: pc?.neu ?? null,
    tiktok: pc?.tiktok ?? { verbunden: false, verbunden_bis: null, entwuerfe: [] },
    laeufe: pc?.laeufe ?? [],
    naechsterLauf: pc?.naechster_lauf ?? null,
    budget: cloud?.budget ?? null,
    abrufe: [...(cloud?.abrufe ?? [])].reverse().slice(0, 10),
    stand: { pc: pc?.stand ?? null, cloud: cloud?.stand ?? null },
    alt: { cloud: alterStunden(cloud?.stand, jetzt) > 7, pc: alterStunden(pc?.stand, jetzt) > 26 },
  };
  a.erfolge = erfolge(a);
  return a;
}
