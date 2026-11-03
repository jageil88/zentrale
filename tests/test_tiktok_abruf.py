"""Cloud-Abruf der TikTok-Zahlen: Zeitplan in Berliner Zeit, Bremse, Zuordnung, nie gute Daten überschreiben."""
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from cloud import tiktok_abruf as ta
from kern import krypto
from kern.branch import Git

KEY = bytes(range(32))
BESCHREIBUNG = "1923: Dein Geld ist nichts mehr wert. Ein Brot kostet Milliarden Mark – wie lange hältst du durch?"
ITEM = {"id": "111", "text": BESCHREIBUNG, "playCount": 10, "diggCount": 2, "commentCount": 0, "shareCount": 0,
        "createTimeISO": "2026-11-03T16:17:54.000Z", "webVideoUrl": "https://www.tiktok.com/@testkanal/video/111",
        "authorMeta": {"fans": 2, "following": 0, "heart": 112, "video": 3}}


def utc(*args):
    return datetime(*args, tzinfo=timezone.utc)


class ZeitplanTest(unittest.TestCase):
    def test_profile_first_then_every_three_hours_with_tolerance(self):
        self.assertEqual(ta.faellige_jobs([], datetime(2026, 11, 4, 2, 59)), ["profil"])
        log = [{"zeit": "2026-11-04T04:27:00", "job": "profil"}]
        self.assertNotIn("profil", ta.faellige_jobs(log, datetime(2026, 11, 4, 6, 0)))
        self.assertIn("profil", ta.faellige_jobs(log, datetime(2026, 11, 4, 7, 17)))  # Cron kam 10 min zu spät

    def test_videos_once_per_day_from_3_berlin(self):
        self.assertIn("videos", ta.faellige_jobs([], datetime(2026, 11, 4, 3, 0)))
        log = [{"zeit": "2026-11-04T04:17:00", "job": "videos"}]
        self.assertNotIn("videos", ta.faellige_jobs(log, datetime(2026, 11, 4, 22, 17)))
        self.assertNotIn("videos", ta.faellige_jobs(log, datetime(2026, 11, 5, 1, 17)))
        self.assertIn("videos", ta.faellige_jobs(log, datetime(2026, 11, 5, 4, 17)))


class ZuordnungTest(unittest.TestCase):
    def test_prefix_rule(self):
        zeile = {"video_id": "111", "titel": BESCHREIBUNG[:80], "link": "L111", "erstellt": "2026-11-03T16:17:54.000Z"}
        pc = [{"nr": 3, "status": "fertig", "beschreibung": BESCHREIBUNG},
              {"nr": 4, "status": "fertig", "beschreibung": "zu kurz"},
              {"nr": 5, "status": "hochgeladen", "beschreibung": BESCHREIBUNG, "tiktok": {"video_id": "999"}}]
        neu = ta.zuordnen(pc, [zeile], {})
        self.assertEqual(neu, {"3": {"video_id": "111", "link": "L111", "hochgeladen": "2026-11-03T17:17:54"}})
        self.assertEqual(ta.zuordnen(pc, [zeile], {"1": {"video_id": "111"}}), {})  # ID schon vergeben


class LaufTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        remote = Path(self._tmp.name) / "r.git"
        subprocess.run(["git", "init", "-q", "--bare", str(remote)], check=True)
        self.git = Git(str(remote))
        self.aufrufe = []

    def tearDown(self):
        self._tmp.cleanup()

    def scraper(self, items=None, fehler=None):
        def fake(handle, n, token, preis):
            self.aufrufe.append((handle, n))
            if fehler:
                raise fehler
            return items if items is not None else [ITEM]
        return fake

    def pc(self, videos=()):
        daten = {"v": 1, "kanal": "testkanal", "videos": list(videos)}
        self.git.ersetzen(ta.BRANCH_PC, {ta.DATEI_PC: krypto.json_verschluesseln(KEY, daten)}, None, "pc")

    def cloud(self, stand, key=KEY):
        self.git.ersetzen(ta.BRANCH_CLOUD, {ta.DATEI_CLOUD: krypto.json_verschluesseln(key, stand)}, None, "cloud")

    def stand(self):
        _, d = self.git.lesen(ta.BRANCH_CLOUD, [ta.DATEI_CLOUD])
        return krypto.json_entschluesseln(KEY, d[ta.DATEI_CLOUD])

    def test_first_run_creates_state_with_profile_row(self):
        self.pc([{"nr": 3, "status": "fertig", "beschreibung": BESCHREIBUNG}])
        r = ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper())
        self.assertEqual(r["jobs"], ["profil", "videos"])
        s = self.stand()
        self.assertEqual([z["art"] for z in s["stats"]], ["profil", "profil", "video"])
        self.assertEqual(s["stats"][0]["zeit"], "2026-11-03T13:00:00")  # Berliner Zeit
        self.assertEqual(self.aufrufe, [("testkanal", 1), ("testkanal", 30)])
        self.assertEqual(s["zuordnung"]["3"]["video_id"], "111")
        self.assertAlmostEqual(s["budget"]["usd"], 0.006)

    def test_night_run_in_utc_is_berlin_time(self):
        self.pc()
        r = ta.lauf(utc(2026, 11, 4, 1, 59), KEY, "tok", self.git, self.scraper())  # 02:59 in Berlin
        self.assertEqual(r["jobs"], ["profil"])

    def test_budget_brake_skips_fetch(self):
        self.pc()
        self.cloud({**ta.neuer_stand(), "budget": {"monat": "2026-11", "usd": 3.999, "limit": 4.0}})
        ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper())
        self.assertEqual(self.aufrufe, [])
        self.assertEqual({a["grund"] for a in self.stand()["abrufe"]}, {"budget"})

    def test_budget_resets_in_new_month(self):
        self.pc()
        self.cloud({**ta.neuer_stand(), "budget": {"monat": "2026-10", "usd": 3.999, "limit": 4.0}})
        ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper())
        self.assertEqual(len(self.aufrufe), 2)
        self.assertEqual(self.stand()["budget"]["monat"], "2026-11")

    def test_decrypt_failure_aborts_without_write(self):
        self.pc()
        self.cloud(ta.neuer_stand(), key=bytes(32))
        vorher = self.git.kopf(ta.BRANCH_CLOUD)
        with self.assertRaises(krypto.FalscherSchluessel):
            ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper())
        self.assertEqual(self.git.kopf(ta.BRANCH_CLOUD), vorher)
        self.assertEqual(self.aufrufe, [])

    def test_scraper_error_logged_state_kept(self):
        self.pc()
        alt = {"zeit": "2026-11-02T10:00:00", "art": "profil", "follower": 1}
        self.cloud({**ta.neuer_stand(), "stats": [alt]})
        r = ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper(fehler=OSError("netz weg")))
        s = self.stand()
        self.assertTrue(r["geschrieben"])
        self.assertEqual(s["stats"], [alt])
        self.assertTrue(all(not a["ok"] and a["grund"].startswith("OSError") for a in s["abrufe"]))

    def test_handle_from_pc_data(self):
        r = ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper())
        self.assertEqual(self.aufrufe, [])
        self.assertEqual({e["grund"] for e in r["eintraege"]}, {"kein Kanal"})

    def test_nothing_due_writes_nothing(self):
        self.pc()
        ta.lauf(utc(2026, 11, 3, 12, 0), KEY, "tok", self.git, self.scraper())
        kopf = self.git.kopf(ta.BRANCH_CLOUD)
        r = ta.lauf(utc(2026, 11, 3, 13, 0), KEY, "tok", self.git, self.scraper())
        self.assertFalse(r["geschrieben"])
        self.assertEqual(self.git.kopf(ta.BRANCH_CLOUD), kopf)


if __name__ == "__main__":
    unittest.main()
