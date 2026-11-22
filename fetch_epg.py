#!/usr/bin/env python3
"""Haalt de Belgische TV-gids (XMLTV van open-epg.com) op en schrijft guide.json.

Het formaat van guide.json lijkt op buildLegacyGuideExport() in
src/server/epgService.ts, maar het venster is langer: een "tv-dag" begint om 06:00
(Brusselse tijd) en het venster loopt 42 uur. Zo zijn er altijd programma's na "nu".
windowStartTs (ms sinds epoch, UTC) laat de app de huidige tijd exact berekenen.

Gebruik:
    python fetch_epg.py                 # live ophalen, schrijft guide.json
    python fetch_epg.py bron.xml[.gz]   # lokaal XMLTV-bestand gebruiken (test)
"""
import gzip
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

EPG_URL = "https://www.open-epg.com/files/belgium.xml.gz"
TZ = ZoneInfo("Europe/Brussels")
OUTPUT = Path("guide.json")
WINDOW_START_HOUR = 6   # een tv-dag begint om 06:00
WINDOW_HOURS = 42       # tv-dag + 18 uur van de volgende dag

# (id, name, category, app, androidPackage, deepLink, exactIds, keywords, excludeKeywords)
CHANNELS = [
    ("vrt1", "VRT 1", "vlaams", "VRT MAX", "be.vrt.vrtnu",
     "https://www.vrt.be/vrtmax/livestream/video/vrt1/",
     ["vrt1.be", "een.be"], ["vrt 1", "vrt1", "een.be"], []),
    ("canvas", "VRT Canvas", "vlaams", "VRT MAX", "be.vrt.vrtnu",
     "https://www.vrt.be/vrtmax/livestream/video/canvas/",
     ["canvas.be"], ["canvas", "vrt canvas"], []),
    ("vtm", "VTM", "vlaams", "VTM GO", "be.vmma.vtm.zenderapp",
     "https://www.vtmgo.be/vtmgo/live-kijken/vtm",
     ["vtm.be"], ["vtm.be", "vtm hd", "vtm"],
     ["vtm 2", "vtm2", "vtm 3", "vtm3", "vtm 4", "vtm4", "gold", "series", "xmas"]),
    ("play4", "Play", "vlaams", "GoPlay", "be.goplay.app",
     "https://www.goplay.be/tv-gids",
     ["play.be", "play4.be"], ["play.be", "play4", "play 4", "vier"],
     ["fictie", "actie", "reality", "crime", "more", "sports", "playboy"]),
    ("vtm2", "VTM 2", "vlaams", "VTM GO", "be.vmma.vtm.zenderapp",
     "https://www.vtmgo.be/vtmgo/live-kijken/vtm2",
     ["vtm2.be"], ["vtm 2", "vtm2"], []),
    ("play5", "Play Fictie", "vlaams", "GoPlay", "be.goplay.app",
     "https://www.goplay.be/tv-gids",
     ["playfictie.be", "play5.be"],
     ["play fictie", "playfictie", "play5", "play 5", "vijf"], []),
    ("play6", "Play Actie", "vlaams", "GoPlay", "be.goplay.app",
     "https://www.goplay.be/tv-gids",
     ["playactie.be", "play6.be"],
     ["play actie", "playactie", "play6", "play 6", "zes"], []),
    ("vtm3", "VTM 3", "vlaams", "VTM GO", "be.vmma.vtm.zenderapp",
     "https://www.vtmgo.be/vtmgo/live-kijken/vtm3",
     ["vtm3.be"], ["vtm 3", "vtm3"], []),
    ("vtm4", "VTM 4", "vlaams", "VTM GO", "be.vmma.vtm.zenderapp",
     "https://www.vtmgo.be/vtmgo/live-kijken/vtm4",
     ["vtm4.be"], ["vtm 4", "vtm4"], []),
    ("ketnet", "Ketnet", "vlaams", "VRT MAX", "be.vrt.vrtnu",
     "https://www.vrt.be/vrtmax/livestream/video/ketnet/",
     ["ketnet.be"], ["ketnet"], []),
    ("laune", "La Une", "waals", "RTBF Auvio", "be.rtbf.auvio",
     "https://auvio.rtbf.be/direct",
     ["laune.be"], ["la une", "laune"], []),
    ("tipik", "Tipik", "waals", "RTBF Auvio", "be.rtbf.auvio",
     "https://auvio.rtbf.be/direct",
     ["tipik.be"], ["tipik"], ["vision", "radio"]),
    ("rtltvi", "RTL TVI", "waals", "RTL play", "com.tapptic.rtl.tvi",
     "https://www.rtlplay.be/direct",
     ["rtltvi.be"], ["rtl tvi", "rtltvi", "rtl-tvi"], []),
    ("rtlclub", "RTL club", "waals", "RTL play", "com.tapptic.rtl.tvi",
     "https://www.rtlplay.be/direct",
     ["rtlclub.be"], ["rtl club", "rtlclub"], []),
    ("arte", "ARTE", "waals", "ARTE", "tv.arte.plus7",
     "https://www.arte.tv/fr/direct/",
     ["artebelgique.be", "arte.be"], ["arte"], []),
    ("npo1", "NPO 1", "nl", "NPO Start", "nl.uitzendinggemist",
     "https://npo.nl/start/live?channel=NPO1",
     ["npo1.be"], ["npo 1", "npo1"], []),
]

# Volgorde en selectie van guide.json (zoals buildLegacyGuideExport)
EXPORT_IDS = ["vrt1", "canvas", "vtm", "vtm2", "play4", "play5", "laune", "rtltvi", "arte"]

GENRE_RULES = [
    ("Jeugd", r"\b(ketnet|karrewiet|kabouter|samson|maya|smurfen|kinderen)\b"),
    ("Nieuws & Actua", r"\b(journaal|nws|nieuws|weerbericht|het weer|terzake|de afspraak|météo|journal|jt |info|aktuell|actua)\b"),
    ("Sport", r"\b(sport|voetbal|wielrennen|koers|sporza|champions league|formule 1|grand prix|tennis|veldrijden|jupiler|pro league)\b"),
    ("Film", r"\b(film|movie|bioscoop|thriller|komedie|action|actiefilm|sciencefiction|romantische komedie|regie:|met o\.a\.)\b"),
    ("Documentaire", r"\b(documentaire|docu|panorama|pano|vranckx|reizen|natuur|geschiedenis|erfgoed|wetenschap|arte reportage)\b"),
    ("Serie & Fictie", r"\b(thuis|familie|serie|aflevering|seizoen|season|episode|politieserie|misdaadserie|drama)\b"),
    ("Entertainment", r"\b(blokken|slimste mens|komen eten|the voice|blind getrouwd|quiz|spelprogramma|show|muziek|concert|talkshow)\b"),
]


def infer_genre(raw_category, title, desc, channel_id):
    if raw_category and raw_category.lower() not in ("tv", "unknown"):
        return raw_category
    text = f"{title} {desc}".lower()
    if channel_id == "ketnet":
        return "Jeugd"
    for genre, pattern in GENRE_RULES:
        if re.search(pattern, text):
            return genre
    return "Programma"


def match_channel(xml_id, display_name):
    id_lower = xml_id.strip().lower()
    combined = f"{xml_id} {display_name}".lower()
    for ch in CHANNELS:
        if id_lower in ch[6]:
            return ch[0]
    for ch in CHANNELS:
        if any(ex in combined for ex in ch[8]):
            continue
        if any(kw in combined for kw in ch[7]):
            return ch[0]
    return None


def parse_ts(raw):
    """XMLTV-tijdstip ('20261121173000 +0100') -> aware datetime (UTC)."""
    m = re.match(r"^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?", (raw or "").strip())
    if not m:
        return None
    y, mo, d, h, mi, s = (int(x) for x in m.groups()[:6])
    dt = datetime(y, mo, d, h, mi, s, tzinfo=timezone.utc)
    if m.group(7):
        offset = (int(m.group(8)) * 60 + int(m.group(9))) * (1 if m.group(7) == "+" else -1)
        dt -= timedelta(minutes=offset)
    return dt


def first_text(elem, tag):
    child = elem.find(tag)
    return (child.text or "").strip() if child is not None else ""


def load_xml(source):
    if source:
        raw = Path(source).read_bytes()
    else:
        req = urllib.request.Request(EPG_URL, headers={"User-Agent": "BEkijk-EPG/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return ET.fromstring(raw)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else None
    root = load_xml(source)
    if root.tag != "tv":
        raise SystemExit(f"Ongeldig XMLTV-bestand: root is <{root.tag}>, verwacht <tv>")

    xml_to_key, claimed = {}, set()
    for ch in root.findall("channel"):
        xml_id = ch.get("id", "")
        key = match_channel(xml_id, first_text(ch, "display-name"))
        if key and key not in claimed:
            xml_to_key[xml_id] = key
            claimed.add(key)

    now = datetime.now(TZ)
    # Voor 06:00 hoort "nu" nog bij de tv-dag van gisteren.
    day_start = (now - timedelta(hours=WINDOW_START_HOUR)).replace(hour=0, minute=0, second=0, microsecond=0)
    window_start = day_start.replace(hour=WINDOW_START_HOUR)
    # Reken in UTC: aftrekken van tijden met dezelfde tzinfo negeert zomer-/wintertijd.
    window_start_utc = window_start.astimezone(timezone.utc)
    window_end_utc = window_start_utc + timedelta(hours=WINDOW_HOURS)

    programs = {ch[0]: [] for ch in CHANNELS}
    for prog in root.findall("programme"):
        key = xml_to_key.get(prog.get("channel", ""))
        if not key:
            continue
        start, end = parse_ts(prog.get("start")), parse_ts(prog.get("stop"))
        if not start or not end or end <= start:
            continue
        if end <= window_start_utc or start >= window_end_utc:
            continue

        title = first_text(prog, "title") or "Geen titel"
        desc = first_text(prog, "desc") or "Geen beschrijving beschikbaar."
        if len(desc) > 320:
            desc = desc[:317] + "..."
        clamped_start, clamped_end = max(start, window_start_utc), min(end, window_end_utc)
        start_local, end_local = start.astimezone(TZ), end.astimezone(TZ)
        duration = round((clamped_end - clamped_start).total_seconds() / 60)
        programs[key].append({
            "title": title,
            "start": start_local.strftime("%H:%M"),
            "end": end_local.strftime("%H:%M"),
            "startMins": max(0, int((clamped_start - window_start_utc).total_seconds() // 60)),
            "durationMins": max(15, duration),
            "genre": infer_genre(first_text(prog, "category"), title, desc, key),
            "desc": desc,
            "_sort": start,
        })

    by_id = {ch[0]: ch for ch in CHANNELS}
    channels = []
    for cid in EXPORT_IDS:
        _, name, category, app, package, deep_link, *_ = by_id[cid]
        items = sorted(programs[cid], key=lambda p: p["_sort"])
        for p in items:
            p.pop("_sort")
        channels.append({
            "id": cid, "name": name, "category": category, "app": app,
            "androidPackage": package, "deepLink": deep_link, "programs": items,
        })

    total = sum(len(c["programs"]) for c in channels)
    empty = [c["id"] for c in channels if not c["programs"]]
    if total == 0:
        # Liever een mislukte run dan een lege guide.json die de goede overschrijft.
        raise SystemExit("Geen enkel programma gevonden in het venster; guide.json niet overschreven.")
    if empty:
        print(f"Waarschuwing: geen programma's voor {', '.join(empty)}", file=sys.stderr)

    OUTPUT.write_text(json.dumps({
        "updatedAt": now.strftime("%Y-%m-%d %H:%M"),
        "windowStartHour": WINDOW_START_HOUR,
        "windowStartTs": int(window_start_utc.timestamp() * 1000),
        "channels": channels,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_icon = sum(1 for p in root.findall("programme") if p.find("icon") is not None)
    all_progs = len(root.findall("programme"))
    print(f"guide.json geschreven: {len(channels)} zenders, {total} programma's "
          f"(venster vanaf {window_start:%Y-%m-%d %H:%M}, {WINDOW_HOURS} uur)")
    print(f"Programma's met afbeelding in de feed: {with_icon} van {all_progs}")


if __name__ == "__main__":
    main()
