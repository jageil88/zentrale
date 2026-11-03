"""Verschlüsselung der Zentrale.

Datei = b"ZEN1" + IV (12 Byte) + AES-256-GCM-Chiffrat mit Tag am Ende – genau das,
was WebCrypto im Browser entschlüsselt. Der Schlüssel kommt per PBKDF2 aus Leons Passwort.
"""
import base64
import hashlib
import json
import os
import secrets

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"ZEN1"
RUNDEN = 600_000
IV_LAENGE = 12
TAG_LAENGE = 16


class FalscherSchluessel(Exception):
    """Die Datei passt nicht zum Schlüssel oder ist keine ZEN1-Datei."""


def schluessel_aus_passwort(passwort: str, salz: bytes, runden: int = RUNDEN) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", passwort.encode("utf-8"), salz, runden, dklen=32)


def verschluesseln(schluessel: bytes, klartext: bytes, iv: bytes | None = None) -> bytes:
    iv = iv or secrets.token_bytes(IV_LAENGE)
    return MAGIC + iv + AESGCM(schluessel).encrypt(iv, klartext, None)


def entschluesseln(schluessel: bytes, daten: bytes) -> bytes:
    kopf = len(MAGIC) + IV_LAENGE
    if len(daten) < kopf + TAG_LAENGE or not daten.startswith(MAGIC):
        raise FalscherSchluessel("keine ZEN1-Datei")
    try:
        return AESGCM(schluessel).decrypt(daten[len(MAGIC):kopf], daten[kopf:], None)
    except InvalidTag:
        raise FalscherSchluessel("Schlüssel passt nicht zur Datei") from None


def json_verschluesseln(schluessel: bytes, obj) -> bytes:
    return verschluesseln(schluessel, json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def json_entschluesseln(schluessel: bytes, daten: bytes):
    return json.loads(entschluesseln(schluessel, daten).decode("utf-8"))


def pruefblock(schluessel: bytes) -> str:
    """Damit prüft der Browser das Passwort, ohne Daten zu laden."""
    return base64.b64encode(verschluesseln(schluessel, b"zentrale-ok")).decode()


def _windows_var(name: str):
    """Windows-Benutzervariable (HKCU\\Environment), falls das Fenster vor dem Setzen geöffnet wurde."""
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
            return winreg.QueryValueEx(k, name)[0].strip() or None
    except (ImportError, OSError):
        return None


def schluessel_aus_umgebung(name: str = "ZENTRALE_SCHLUESSEL"):
    wert = os.environ.get(name) or _windows_var(name)
    return base64.b64decode(wert) if wert else None
