"""TikTok-Zahlen aus der Cloud: läuft per GitHub Actions alle 3 Stunden, auch wenn der PC aus ist.

Liest den verschlüsselten Stand vom Branch daten-tiktok-cloud, holt fällige Zahlen über Apify (nie über
4 $ im Monat), ordnet gepostete Videos zu und ersetzt den Branch. Passt der Schlüssel nicht, wird nichts
geschrieben. Den Kanal liest er aus den verschlüsselten PC-Daten, damit er nicht im öffentlichen Code steht.
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from cloud.apify import parse_items, run_scraper
from kern import krypto
from kern.branch import Git, Ueberholt

BERLIN = ZoneInfo("Europe/Berlin")
BRANCH_CLOUD, DATEI_CLOUD = "daten-tiktok-cloud", "tiktok-cloud.enc"
BRANCH_PC, DATEI_PC = "daten-tiktok-pc", "tiktok-pc.enc"
PREIS = 0.003            # Apify Free-Plan, clockworks/tiktok-profile-scraper
LIMIT = 4.0              # Bremse pro Kalendermonat, Guthaben ist 5 $
PROFIL_STUNDEN = 3
VIDEO_STUNDE = 3         # Video-Zahlen 1x täglich ab 3:00 Berliner Zeit
NEUESTE = 30
SPIELRAUM = timedelta(minutes=30)  # GitHub startet geplante Läufe oft einige Minuten zu spät


def neuer_stand() -> dict:
    return {"v": 1, "stand": None, "stats": [], "abrufe": [],
            "budget": {"monat": None, "usd": 0.0, "limit": LIMIT}, "zuordnung": {}}


def _letzter(abrufe: list, job: str):
    zeiten = [datetime.fromisoformat(a["zeit"]) for a in abrufe if a.get("job") == job]
    return max(zeiten) if zeiten else None


def faellige_jobs(abrufe: list, jetzt: datetime) -> list:
    """jetzt = naive Berliner Zeit. Zählt auch fehlgeschlagene Versuche, damit nichts im Takt wiederholt wird."""
    jobs = []
    p = _letzter(abrufe, "profil")
    if p is None or jetzt - p >= timedelta(hours=PROFIL_STUNDEN) - SPIELRAUM:
        jobs.append("profil")
    v = _letzter(abrufe, "videos")
    if jetzt.hour >= VIDEO_STUNDE and (v is None or v.date() < jetzt.date()):
        jobs.append("videos")
    return jobs


def _norm(text) -> str:
    return " ".join(str(text or "").lower().split())


def _berlin(iso):
    try:
        t = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    return (t.astimezone(BERLIN).replace(tzinfo=None) if t.tzinfo else t).isoformat(timespec="seconds")


def zuordnen(pc_videos: list, video_zeilen: list, schon: dict) -> dict:
    """Gepostete TikTok-Videos über den Anfang der Beschreibung zuordnen (wie bisher am PC)."""
    vergeben = {z.get("video_id") for z in schon.values()}
    vergeben |= {(v.get("tiktok") or {}).get("video_id") for v in pc_videos}
    vergeben.discard(None)
    neu = {}
    for v in sorted(pc_videos, key=lambda v: v["nr"]):
        if str(v["nr"]) in schon or v.get("status") not in ("fertig", "entwurf", "hochgeladen") \
                or (v.get("tiktok") or {}).get("video_id"):
            continue
        start = _norm(v.get("beschreibung"))[:40]
        if len(start) < 20:  # zu kurz, um sicher zuzuordnen
            continue
        zeile = next((z for z in video_zeilen
                      if z.get("video_id") not in vergeben and _norm(z.get("titel")).startswith(start)), None)
        if zeile is None:
            continue
        neu[str(v["nr"])] = {"video_id": zeile["video_id"], "link": zeile.get("link"),
                             "hochgeladen": _berlin(zeile.get("erstellt"))}
        vergeben.add(zeile["video_id"])
    return neu


def _job(job: str, stand: dict, jetzt: datetime, pc, token, scraper) -> dict:
    n = 1 if job == "profil" else NEUESTE
    eintrag = {"zeit": jetzt.isoformat(timespec="seconds"), "job": job, "ok": False, "ergebnisse": 0, "usd": 0.0}
    budget = stand["budget"]
    if budget.get("monat") != jetzt.strftime("%Y-%m"):
        budget.update(monat=jetzt.strftime("%Y-%m"), usd=0.0)
    kanal = (pc or {}).get("kanal")
    if not kanal:
        eintrag["grund"] = "kein Kanal"
    elif not token:
        eintrag["grund"] = "kein APIFY_TOKEN"
    elif budget["usd"] + n * PREIS > LIMIT + 1e-9:
        eintrag["grund"] = "budget"
    else:
        try:
            items = scraper(kanal, n, token, PREIS)
        except Exception as e:  # Netz, Zeitlimit, Apify-Fehler: alter Stand bleibt, nächster Versuch nach Plan
            eintrag["grund"] = f"{type(e).__name__}: {str(e)[:120]}"
        else:
            usd = len(items) * PREIS
            budget["usd"] = round(budget["usd"] + usd, 6)
            profil, videos = parse_items(items, jetzt)
            stand["stats"].extend(([profil] if profil else []) + (videos if job == "videos" else []))
            eintrag.update(ok=True, ergebnisse=len(items), usd=round(usd, 4))
            if neu := zuordnen((pc or {}).get("videos", []), videos, stand["zuordnung"]):  # auch der Profil-Abruf
                stand["zuordnung"].update(neu)
                eintrag["zugeordnet"] = sorted(int(k) for k in neu)
            if not items:
                eintrag["grund"] = "keine Videos auf dem Kanal"
    return eintrag


def lauf(jetzt_utc: datetime, schluessel: bytes, apify_token, git: Git, scraper=run_scraper) -> dict:
    jetzt = jetzt_utc.astimezone(BERLIN).replace(tzinfo=None, microsecond=0)
    sha, dateien = git.lesen(BRANCH_CLOUD, [DATEI_CLOUD])
    # passt der Schlüssel nicht, fliegt FalscherSchluessel hier – vor jedem Schreiben
    stand = krypto.json_entschluesseln(schluessel, dateien[DATEI_CLOUD]) if DATEI_CLOUD in dateien else neuer_stand()
    jobs = faellige_jobs(stand["abrufe"], jetzt)
    if not jobs:
        return {"jobs": [], "geschrieben": False, "eintraege": []}
    _, pc_dateien = git.lesen(BRANCH_PC, [DATEI_PC])
    try:
        pc = krypto.json_entschluesseln(schluessel, pc_dateien[DATEI_PC]) if DATEI_PC in pc_dateien else None
    except krypto.FalscherSchluessel:  # PC noch mit altem Schlüssel: dann fehlt eben der Kanal
        pc = None
    eintraege = [_job(job, stand, jetzt, pc, apify_token, scraper) for job in jobs]
    stand["abrufe"].extend(eintraege)
    stand["stand"] = jetzt.isoformat(timespec="seconds")
    git.ersetzen(BRANCH_CLOUD, {DATEI_CLOUD: krypto.json_verschluesseln(schluessel, stand)}, sha,
                 f"Zahlen {jetzt:%d.%m.%Y %H:%M}")
    return {"jobs": jobs, "geschrieben": True, "eintraege": eintraege}


def main() -> int:
    schluessel = krypto.schluessel_aus_umgebung()
    if not schluessel:
        print("Noch nicht eingerichtet (ZENTRALE_SCHLUESSEL fehlt) – nichts zu tun.")
        return 0
    repo = os.environ.get("GITHUB_REPOSITORY", "jageil88/zentrale")
    zugang = os.environ.get("GITHUB_TOKEN")
    remote = f"https://x-access-token:{zugang}@github.com/{repo}.git" if zugang else f"https://github.com/{repo}.git"
    try:
        r = lauf(datetime.now(timezone.utc), schluessel, os.environ.get("APIFY_TOKEN"), Git(remote))
    except Ueberholt:
        print("Der Daten-Branch wurde gerade ersetzt – nächster Lauf.")
        return 0
    except krypto.FalscherSchluessel:
        print("Der Cloud-Stand passt nicht zum Schlüssel – nichts geschrieben.")
        return 1
    if not r["jobs"]:
        print("Nichts fällig.")
    for e in r["eintraege"]:
        print(f"{e['job']}: {'ok' if e['ok'] else e.get('grund')}, {e['ergebnisse']} Ergebnisse, {e['usd']} $")
    return 0


if __name__ == "__main__":
    sys.exit(main())
