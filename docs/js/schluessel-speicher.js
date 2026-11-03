// Merkt sich den Schlüssel als nicht exportierbaren CryptoKey in IndexedDB („Angemeldet bleiben“).
// Das Passwort selbst wird nie gespeichert. Ohne IndexedDB (privates Fenster) geht es eben ohne Merken.
const DB = "zentrale";
const ABLAGE = "schluessel";
const ID = "aktuell";

function oeffnen() {
  return new Promise((gut, schlecht) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ABLAGE);
    r.onsuccess = () => gut(r.result);
    r.onerror = () => schlecht(r.error);
  });
}

async function vorgang(art, fn) {
  const db = await oeffnen();
  return new Promise((gut, schlecht) => {
    const t = db.transaction(ABLAGE, art);
    const anfrage = fn(t.objectStore(ABLAGE));
    t.oncomplete = () => { db.close(); gut(anfrage.result); };
    t.onerror = () => { db.close(); schlecht(t.error); };
  });
}

export async function merken(key) {
  try { await vorgang("readwrite", (s) => s.put(key, ID)); } catch { /* ohne Merken weiter */ }
}

export async function holen() {
  try { return (await vorgang("readonly", (s) => s.get(ID))) ?? null; } catch { return null; }
}

export async function vergessen() {
  try { await vorgang("readwrite", (s) => s.delete(ID)); } catch { /* nichts gemerkt */ }
}
