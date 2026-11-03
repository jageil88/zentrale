"""Daten-Branches: genau ein Commit, Lesen als Bytes, Lease gegen Überschreiben."""
import subprocess
import tempfile
import unittest
from pathlib import Path

from kern.branch import Git, Ueberholt


class BranchTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.remote = Path(self._tmp.name) / "remote.git"
        subprocess.run(["git", "init", "-q", "--bare", str(self.remote)], check=True)
        self.git = Git(str(self.remote))

    def tearDown(self):
        self._tmp.cleanup()

    def test_missing_branch(self):
        self.assertIsNone(self.git.kopf("daten-x"))
        self.assertEqual(self.git.lesen("daten-x", ["a.enc"]), (None, {}))

    def test_replace_then_read_binary_roundtrip(self):
        inhalt = bytes(range(256)) * 3 + b"\r\n\n"
        sha = self.git.ersetzen("daten-x", {"a.enc": inhalt, "b.enc": b"zwei"}, None, "erster Stand")
        self.assertEqual(self.git.kopf("daten-x"), sha)
        kopf, dateien = self.git.lesen("daten-x", ["a.enc", "fehlt.enc"])
        self.assertEqual(kopf, sha)
        self.assertEqual(dateien, {"a.enc": inhalt})

    def test_single_commit(self):
        sha1 = self.git.ersetzen("daten-x", {"a.enc": b"1"}, None, "eins")
        sha2 = self.git.ersetzen("daten-x", {"a.enc": b"2"}, sha1, "zwei")
        anzahl = subprocess.run(["git", "-C", str(self.remote), "rev-list", "--count", sha2],
                                capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(anzahl, "1")
        self.assertEqual(self.git.lesen("daten-x", ["a.enc"])[1], {"a.enc": b"2"})

    def test_lease_rejects_moved_branch(self):
        sha1 = self.git.ersetzen("daten-x", {"a.enc": b"start"}, None, "start")
        self.git.ersetzen("daten-x", {"a.enc": b"von B"}, sha1, "B")
        with self.assertRaises(Ueberholt):
            self.git.ersetzen("daten-x", {"a.enc": b"von A"}, sha1, "A")
        self.assertEqual(self.git.lesen("daten-x", ["a.enc"])[1], {"a.enc": b"von B"})

    def test_lease_none_requires_absent_branch(self):
        self.git.ersetzen("daten-x", {"a.enc": b"da"}, None, "da")
        with self.assertRaises(Ueberholt):
            self.git.ersetzen("daten-x", {"a.enc": b"neu"}, None, "neu")


if __name__ == "__main__":
    unittest.main()
