"""Daten-Branches der Zentrale: Jeder hat genau einen Commit und wird bei jedem Update ersetzt.

So wächst das Repo nicht mit jedem Video. Geschrieben wird mit --force-with-lease auf den zuletzt
gelesenen Commit: Hat ein anderer Schreiber den Branch inzwischen ersetzt, gewinnt er, und wir
versuchen es beim nächsten Mal.
"""
import os
import re
import shutil
import stat
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path

OPTIONEN = ["-c", "user.name=Zentrale", "-c", "user.email=zentrale@users.noreply.github.com",
            "-c", "core.autocrlf=false"]


class Ueberholt(Exception):
    """Der Branch hat sich seit dem Lesen geändert."""


@contextmanager
def _tempordner():
    pfad = tempfile.mkdtemp(prefix="zentrale-")
    try:
        yield pfad
    finally:  # Git legt Objekte schreibgeschützt ab; unter Windows erst freigeben, dann löschen
        shutil.rmtree(pfad, onerror=lambda f, p, _: (os.chmod(p, stat.S_IWRITE), f(p)))


def _ohne_zugang(text: str) -> str:
    return re.sub(r"://[^@/\s]+@", "://***@", text)


class Git:
    def __init__(self, remote: str, run=subprocess.run):
        self.remote = remote
        self.run = run

    def _git(self, cwd, *args, check=True):
        r = self.run(["git", *OPTIONEN, *args], cwd=cwd, capture_output=True)
        if check and r.returncode != 0:
            raise RuntimeError(f"git {args[0]} fehlgeschlagen: {_ohne_zugang(r.stderr.decode(errors='replace')).strip()[:300]}")
        return r

    def kopf(self, branch: str):
        teile = self._git(None, "ls-remote", self.remote, f"refs/heads/{branch}").stdout.decode().split()
        return teile[0] if teile else None

    def lesen(self, branch: str, dateien: list):
        """(Commit, {Name: Bytes}) des Branches; fehlt er, (None, {}). Fehlende Dateien fehlen im dict."""
        with _tempordner() as tmp:
            self._git(tmp, "init", "-q")
            r = self._git(tmp, "fetch", "-q", "--depth", "1", self.remote, f"refs/heads/{branch}", check=False)
            if r.returncode != 0:
                if "couldn't find remote ref" in r.stderr.decode(errors="replace"):
                    return None, {}
                raise RuntimeError(f"git fetch fehlgeschlagen: {_ohne_zugang(r.stderr.decode(errors='replace')).strip()[:300]}")
            sha = self._git(tmp, "rev-parse", "FETCH_HEAD").stdout.decode().strip()
            gefunden = {}
            for name in dateien:
                show = self._git(tmp, "show", f"{sha}:{name}", check=False)
                if show.returncode == 0:
                    gefunden[name] = show.stdout
            return sha, gefunden

    def ersetzen(self, branch: str, dateien: dict, erwartet, nachricht: str) -> str:
        """Ersetzt den Branch durch einen einzigen Commit mit genau diesen Dateien."""
        with _tempordner() as tmp:
            self._git(tmp, "init", "-q")
            for name, inhalt in dateien.items():
                ziel = Path(tmp) / name
                ziel.parent.mkdir(parents=True, exist_ok=True)
                ziel.write_bytes(inhalt)
            self._git(tmp, "add", "-A")
            self._git(tmp, "commit", "-q", "-m", nachricht)
            sha = self._git(tmp, "rev-parse", "HEAD").stdout.decode().strip()
            r = self._git(tmp, "push", "-q", f"--force-with-lease=refs/heads/{branch}:{erwartet or ''}",
                          self.remote, f"HEAD:refs/heads/{branch}", check=False)
            if r.returncode != 0:
                fehler = _ohne_zugang(r.stderr.decode(errors="replace"))
                if "stale info" in fehler or "rejected" in fehler:
                    raise Ueberholt(branch)
                raise RuntimeError(f"git push fehlgeschlagen: {fehler.strip()[:300]}")
            return sha
