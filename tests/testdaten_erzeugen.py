"""Erzeugt testdaten/ und testdaten-leer/ zum Prüfen der Webseite im Browser (beide sind gitignored).

Aufruf (im Repo-Ordner): python -m tests.testdaten_erzeugen <Projektordner> [--neu NR]
Der Projektordner ist der lokale Ordner mit videos/ und data/; echte Inhalte landen nur in den
gitignorten Testordnern. Test-Passwort: test-passwort-123. Webseite dann z. B. unter
http://localhost:8790/docs/?basis=/testdaten/ öffnen.
"""
import argparse
import base64
import json
from pathlib import Path

from kern import krypto

PASSWORT = "test-passwort-123"
SALZ = bytes(range(16))
WURZEL = Path(__file__).resolve().parent.parent


def jsonl(path: Path) -> list:
    if not path.is_file():
        return []
    return [json.loads(z) for z in path.read_text(encoding="utf-8").splitlines() if z.strip()]


def schreiben(ordner: Path, key: bytes, pc, cloud, dateien=None):
    ordner.mkdir(parents=True, exist_ok=True)
    einstellung = {"v": 1, "salz": base64.b64encode(SALZ).decode(), "runden": krypto.RUNDEN, "pruef": krypto.pruefblock(key)}
    (ordner / "schluessel.json").write_text(json.dumps(einstellung), encoding="utf-8")
    if pc is not None:
        (ordner / "daten-tiktok-pc").mkdir(exist_ok=True)
        (ordner / "daten-tiktok-pc" / "tiktok-pc.enc").write_bytes(krypto.json_verschluesseln(key, pc))
        for name, inhalt in (dateien or {}).items():
            (ordner / "daten-tiktok-pc" / name).write_bytes(krypto.verschluesseln(key, inhalt))
    if cloud is not None:
        (ordner / "daten-tiktok-cloud").mkdir(exist_ok=True)
        (ordner / "daten-tiktok-cloud" / "tiktok-cloud.enc").write_bytes(krypto.json_verschluesseln(key, cloud))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("projekt", type=Path)
    ap.add_argument("--neu", type=int, help="dieses Video als neuestes, noch nicht gepostetes zeigen")
    a = ap.parse_args()
    key = krypto.schluessel_aus_passwort(PASSWORT, SALZ)

    videos = []
    for d in sorted((a.projekt / "videos").iterdir()):
        if (d / "video.json").is_file():
            v = json.loads((d / "video.json").read_text(encoding="utf-8"))
            v["ordner"] = d.name
            videos.append(v)
    videos.sort(key=lambda v: v["nr"], reverse=True)
    dateien, neu = {}, None
    if a.neu:
        v = next(v for v in videos if v["nr"] == a.neu)
        v["status"], v["tiktok"] = "fertig", {"link": None, "video_id": None, "hochgeladen": None}
        dateien["video-neu.enc"] = (a.projekt / "videos" / v["ordner"] / v["datei"]).read_bytes()
        if v.get("vorschau"):
            dateien["vorschau-neu.enc"] = (a.projekt / "videos" / v["ordner"] / v["vorschau"]).read_bytes()
        neu = {"nr": v["nr"], "video": "video-neu.enc", "vorschau": "vorschau-neu.enc" if v.get("vorschau") else None}
    daten = a.projekt / "data"
    pc = {"v": 1, "stand": "2026-11-04T00:30:00", "kanal": "testkanal", "videos": videos, "neu": neu,
          "tiktok": {"verbunden": False, "verbunden_bis": None, "entwuerfe": []},
          "laeufe": jsonl(daten / "laeufe.jsonl")[::-1], "naechster_lauf": "2026-11-04T10:00:00"}
    budget = json.loads((daten / "apify-verbrauch.json").read_text(encoding="utf-8")) if (daten / "apify-verbrauch.json").is_file() else {}
    cloud = {"v": 1, "stand": "2026-11-04T00:17:00", "stats": jsonl(daten / "stats.jsonl"), "abrufe": jsonl(daten / "abrufe.jsonl"),
             "budget": {"monat": budget.get("monat"), "usd": budget.get("usd", 0.0), "limit": 4.0}, "zuordnung": {}}
    schreiben(WURZEL / "testdaten", key, pc, cloud, dateien)
    schreiben(WURZEL / "testdaten-leer", key, {**pc, "videos": [], "neu": None, "laeufe": []}, None)
    print("testdaten/ und testdaten-leer/ geschrieben")


if __name__ == "__main__":
    main()
