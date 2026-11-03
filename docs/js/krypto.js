// Entschlüsselt die .enc-Dateien der Zentrale: "ZEN1" + IV (12 Byte) + AES-256-GCM mit Tag am Ende.
// Der Schlüssel entsteht per PBKDF2 aus Leons Passwort und verlässt den Browser nie.
const MAGIC = [90, 69, 78, 49]; // "ZEN1"

const ausBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function schluesselAusPasswort(passwort, salzB64, runden) {
  const basis = await crypto.subtle.importKey("raw", new TextEncoder().encode(passwort), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: ausBase64(salzB64), iterations: runden },
    basis, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}

export async function entschluesseln(key, puffer) {
  const daten = new Uint8Array(puffer);
  if (daten.length < 32 || MAGIC.some((b, i) => daten[i] !== b)) throw new Error("falscher-schluessel");
  try {
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv: daten.slice(4, 16) }, key, daten.slice(16));
  } catch {
    throw new Error("falscher-schluessel");
  }
}

export async function pruefen(key, pruefB64) {
  try {
    return new TextDecoder().decode(await entschluesseln(key, ausBase64(pruefB64).buffer)) === "zentrale-ok";
  } catch {
    return false;
  }
}
