"""Verschlüsselung der Zentrale: Dateiformat ZEN1, AES-GCM, Schlüssel aus Passwort."""
import base64
import json
import os
import unittest
from pathlib import Path
from unittest import mock

from kern import krypto

b64 = base64.b64decode
KEY = bytes(range(32))


class KryptoTest(unittest.TestCase):
    def test_roundtrip_bytes_and_json(self):
        daten = krypto.verschluesseln(KEY, b"\x00\xffhallo")
        self.assertTrue(daten.startswith(krypto.MAGIC))
        self.assertEqual(krypto.entschluesseln(KEY, daten), b"\x00\xffhallo")
        obj = {"zahl": 942, "text": "Größe ✅"}
        self.assertEqual(krypto.json_entschluesseln(KEY, krypto.json_verschluesseln(KEY, obj)), obj)

    def test_wrong_key_raises(self):
        daten = krypto.verschluesseln(KEY, b"geheim")
        with self.assertRaises(krypto.FalscherSchluessel):
            krypto.entschluesseln(bytes(32), daten)

    def test_bad_magic_raises(self):
        daten = krypto.verschluesseln(KEY, b"geheim")
        with self.assertRaises(krypto.FalscherSchluessel):
            krypto.entschluesseln(KEY, b"XXXX" + daten[4:])
        with self.assertRaises(krypto.FalscherSchluessel):
            krypto.entschluesseln(KEY, b"ZEN")

    def test_iv_random_per_call(self):
        self.assertNotEqual(krypto.verschluesseln(KEY, b"gleich"), krypto.verschluesseln(KEY, b"gleich"))

    def test_vector(self):
        v = json.loads((Path(__file__).parent / "testvektor.json").read_text(encoding="utf-8"))
        key = krypto.schluessel_aus_passwort(v["passwort"], b64(v["salz"]), v["runden"])
        self.assertEqual(key, b64(v["schluessel"]))
        klartext = v["klartext"].encode()
        self.assertEqual(krypto.verschluesseln(key, klartext, b64(v["iv"])), b64(v["daten"]))
        self.assertEqual(krypto.entschluesseln(key, b64(v["daten"])), klartext)

    def test_pruefblock_decrypts_to_marker(self):
        self.assertEqual(krypto.entschluesseln(KEY, b64(krypto.pruefblock(KEY))), b"zentrale-ok")

    def test_schluessel_aus_umgebung(self):
        with mock.patch.dict(os.environ, {"ZENTRALE_SCHLUESSEL": base64.b64encode(KEY).decode()}):
            self.assertEqual(krypto.schluessel_aus_umgebung(), KEY)
        with mock.patch.dict(os.environ, {"ZENTRALE_SCHLUESSEL": ""}), \
                mock.patch.object(krypto, "_windows_var", return_value=None):
            self.assertIsNone(krypto.schluessel_aus_umgebung())


if __name__ == "__main__":
    unittest.main()
