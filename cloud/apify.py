"""TikTok-Zahlen über den Apify-Baustein clockworks/tiktok-profile-scraper."""
import json
import urllib.request
from datetime import datetime

ACTOR = "clockworks~tiktok-profile-scraper"


def run_scraper(handle: str, n: int, token: str, price: float, opener=urllib.request.urlopen) -> list:
    """Holt die neuesten n Videos eines Profils. Apify bricht ab, bevor mehr als n Ergebnisse berechnet werden."""
    cap = f"{round(n * price + 0.001, 4):g}"
    url = f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items?timeout=240&maxTotalChargeUsd={cap}"
    body = {"profiles": [handle], "resultsPerPage": n, "profileSorting": "latest",
            "profileScrapeSections": ["videos"], "excludePinnedPosts": False}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with opener(req, timeout=300) as resp:
        return json.load(resp)


def parse_items(items: list, now: datetime):
    """Apify-Ergebnisse -> (Profil-Zeile oder None, Liste der Video-Zeilen) für stats.jsonl."""
    zeit = now.isoformat(timespec="seconds")
    items = [i for i in items if isinstance(i, dict)]
    a = next((i["authorMeta"] for i in items if i.get("authorMeta")), None)
    profil = {"zeit": zeit, "art": "profil", "follower": a.get("fans"), "gefolgt": a.get("following"),
              "likes": a.get("heart"), "videos": a.get("video")} if a else None
    items = [i for i in items if i.get("id")]  # ohne id: Hinweis wie "Profile has no videos"
    videos = [{"zeit": zeit, "art": "video", "video_id": str(i["id"]), "aufrufe": i.get("playCount"),
               "likes": i.get("diggCount"), "kommentare": i.get("commentCount"), "shares": i.get("shareCount"),
               "titel": (i.get("text") or "")[:80], "erstellt": i.get("createTimeISO"), "link": i.get("webVideoUrl")}
              for i in items]
    return profil, videos
