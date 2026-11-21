import gzip
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

# Publieke Belgische EPG-bron (wordt dagelijks bijgewerkt)
EPG_URL = "https://www.open-epg.com/files/belgium.xml.gz"
BRUSSELS_TZ = ZoneInfo("Europe/Brussels")

# Mapping van XMLTV channel-ID's/namen naar onze zenders en streaming-apps.
# Opmerking: Play4 en Play5 heten in de Belgische EPG nu Play.be en PlayFictie.be.
CHANNEL_CONFIG = {
    "vrt1": {
        "id": "vrt1",
        "name": "VRT 1",
        "category": "vlaams",
        "app": "VRT MAX",
        "deepLink": "https://www.vrt.be/vrtmax/livestream/video/vrt1/",
        "exactIds": ["vrt1.be", "een.be"],
        "keywords": ["vrt 1", "een.be", "vrt1"],
        "exclude": [],
    },
    "canvas": {
        "id": "canvas",
        "name": "VRT Canvas",
        "category": "vlaams",
        "app": "VRT MAX",
        "deepLink": "https://www.vrt.be/vrtmax/livestream/video/canvas/",
        "exactIds": ["canvas.be"],
        "keywords": ["canvas", "vrt canvas"],
        "exclude": [],
    },
    "ketnet": {
        "id": "ketnet",
        "name": "Ketnet",
        "category": "vlaams",
        "app": "VRT MAX",
        "deepLink": "https://www.vrt.be/vrtmax/livestream/video/ketnet/",
        "exactIds": ["ketnet.be"],
        "keywords": ["ketnet"],
        "exclude": [],
    },
    "vtm": {
        "id": "vtm",
        "name": "VTM",
        "category": "vlaams",
        "app": "VTM GO",
        "deepLink": "https://www.vtmgo.be/vtmgo/live-kijken/vtm",
        "exactIds": ["vtm.be"],
        "keywords": ["vtm.be", "vtm hd", "vtm"],
        "exclude": ["vtm 2", "vtm2", "vtm 3", "vtm3", "vtm 4", "vtm4", "gold", "series", "xmas"],
    },
    "vtm2": {
        "id": "vtm2",
        "name": "VTM 2",
        "category": "vlaams",
        "app": "VTM GO",
        "deepLink": "https://www.vtmgo.be/vtmgo/live-kijken/vtm2",
        "exactIds": ["vtm2.be"],
        "keywords": ["vtm 2", "vtm2"],
        "exclude": [],
    },
    "vtm3": {
        "id": "vtm3",
        "name": "VTM 3",
        "category": "vlaams",
        "app": "VTM GO",
        "deepLink": "https://www.vtmgo.be/vtmgo/live-kijken/vtm3",
        "exactIds": ["vtm3.be"],
        "keywords": ["vtm 3", "vtm3"],
        "exclude": [],
    },
    "vtm4": {
        "id": "vtm4",
        "name": "VTM 4",
        "category": "vlaams",
        "app": "VTM GO",
        "deepLink": "https://www.vtmgo.be/vtmgo/live-kijken/vtm4",
        "exactIds": ["vtm4.be"],
        "keywords": ["vtm 4", "vtm4"],
        "exclude": [],
    },
    "play4": {
        "id": "play4",
        "name": "Play",
        "category": "vlaams",
        "app": "GoPlay",
        "deepLink": "https://www.goplay.be/tv-gids",
        "exactIds": ["play.be", "play4.be"],
        "keywords": ["play.be", "play4", "play 4", "vier"],
        "exclude": ["fictie", "actie", "reality", "crime", "more", "sports", "playboy"],
    },
    "play5": {
        "id": "play5",
        "name": "Play Fictie",
        "category": "vlaams",
        "app": "GoPlay",
        "deepLink": "https://www.goplay.be/tv-gids",
        "exactIds": ["playfictie.be", "play5.be"],
        "keywords": ["play fictie", "playfictie", "play5", "play 5", "vijf"],
        "exclude": [],
    },
    "play6": {
        "id": "play6",
        "name": "Play Actie",
        "category": "vlaams",
        "app": "GoPlay",
        "deepLink": "https://www.goplay.be/tv-gids",
        "exactIds": ["playactie.be", "play6.be"],
        "keywords": ["play actie", "playactie", "play6", "play 6", "zes"],
        "exclude": [],
    },
    "laune": {
        "id": "laune",
        "name": "La Une",
        "category": "waals",
        "app": "RTBF Auvio",
        "deepLink": "https://auvio.rtbf.be/direct",
        "exactIds": ["laune.be"],
        "keywords": ["la une", "laune"],
        "exclude": [],
    },
    "tipik": {
        "id": "tipik",
        "name": "Tipik",
        "category": "waals",
        "app": "RTBF Auvio",
        "deepLink": "https://auvio.rtbf.be/direct",
        "exactIds": ["tipik.be"],
        "keywords": ["tipik"],
        "exclude": ["vision", "radio"],
    },
    "rtltvi": {
        "id": "rtltvi",
        "name": "RTL TVI",
        "category": "waals",
        "app": "RTL play",
        "deepLink": "https://www.rtlplay.be/direct",
        "exactIds": ["rtltvi.be"],
        "keywords": ["rtl tvi", "rtltvi", "rtl-tvi"],
        "exclude": [],
    },
    "rtlclub": {
        "id": "rtlclub",
        "name": "RTL club",
        "category": "waals",
        "app": "RTL play",
        "deepLink": "https://www.rtlplay.be/direct",
        "exactIds": ["rtlclub.be"],
        "keywords": ["rtl club", "rtlclub"],
        "exclude": [],
    },
    "arte": {
        "id": "arte",
        "name": "ARTE",
        "category": "waals",
        "app": "ARTE",
        "deepLink": "https://www.arte.tv/fr/direct/",
        "exactIds": ["artebelgique.be", "arte.be"],
        "keywords": ["arte"],
        "exclude": [],
    },
    "npo1": {
        "id": "npo1",
        "name": "NPO 1",
        "category": "nl",
        "app": "NPO Start",
        "deepLink": "https://npo.nl/start/live?channel=NPO1",
        "exactIds": ["npo1.be"],
        "keywords": ["npo 1", "npo1"],
        "exclude": [],
    },
}

CHANNEL_ORDER = [
    "vrt1",
    "canvas",
    "vtm",
    "play4",
    "vtm2",
    "play5",
    "play6",
    "vtm3",
    "vtm4",
    "ketnet",
    "laune",
    "tipik",
    "rtltvi",
    "rtlclub",
    "arte",
    "npo1",
]


def parse_xmltv_time(time_str: str) -> datetime:
    clean = time_str.strip()
    dt = datetime.strptime(clean[:14], "%Y%m%d%H%M%S")
    if len(clean) > 14:
        offset_str = clean[14:].strip()
        if len(offset_str) >= 5 and offset_str[0] in ("+", "-"):
            sign = 1 if offset_str[0] == "+" else -1
            hours = int(offset_str[1:3])
            mins = int(offset_str[3:5])
            tz = timezone(timedelta(hours=sign * hours, minutes=sign * mins))
            dt = dt.replace(tzinfo=tz)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BRUSSELS_TZ)


def match_channel(xml_id: str, display_name: str) -> str | None:
    id_lower = xml_id.strip().lower()
    combined = f"{xml_id} {display_name}".lower()

    # Stap 1: Exacte XMLTV ID-match (voorkomt conflicten zoals Play.be vs PlayFictie.be)
    for key in CHANNEL_ORDER:
        cfg = CHANNEL_CONFIG[key]
        if id_lower in cfg["exactIds"]:
            return key

    # Stap 2: Keyword-fallback met uitsluitingen
    for key in CHANNEL_ORDER:
        cfg = CHANNEL_CONFIG[key]
        if any(ex in combined for ex in cfg["exclude"]):
            continue
        if any(kw in combined for kw in cfg["keywords"]):
            return key

    return None


def infer_genre(raw_cat: str, title: str, desc: str, channel_id: str) -> str:
    if raw_cat and raw_cat.strip().lower() not in ("tv", "unknown", ""):
        return raw_cat.strip()

    text = f"{title} {desc}".lower()
    if channel_id == "ketnet" or re.search(r"\b(ketnet|karrewiet|kabouter|samson|maya|smurfen|kinderen)\b", text):
        return "Jeugd"
    if re.search(r"\b(journaal|nws|nieuws|weerbericht|het weer|terzake|de afspraak|météo|journal|jt |actua)\b", text):
        return "Nieuws & Actua"
    if re.search(r"\b(sport|voetbal|wielrennen|koers|sporza|champions league|formule 1|grand prix|tennis|veldrijden|pro league)\b", text):
        return "Sport"
    if re.search(r"\b(film|movie|bioscoop|thriller|komedie|action|actiefilm|sciencefiction|regie:)\b", text):
        return "Film"
    if re.search(r"\b(documentaire|docu|panorama|pano|vranckx|reizen|natuur|geschiedenis|erfgoed|wetenschap)\b", text):
        return "Documentaire"
    if re.search(r"\b(thuis|familie|serie|aflevering|seizoen|season|episode|politieserie|misdaadserie|drama)\b", text):
        return "Serie & Fictie"
    if re.search(r"\b(blokken|slimste mens|komen eten|the voice|blind getrouwd|quiz|spelprogramma|show|muziek|talkshow)\b", text):
        return "Entertainment"
    return "Programma"


def build_guide(window_start_hour: int = 6, window_hours: int = 20) -> None:
    print("Belgische XMLTV-feed downloaden...")
    req = urllib.request.Request(EPG_URL, headers={"User-Agent": "KijkBE-EPG/2.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        raw_data = response.read()
        xml_bytes = gzip.decompress(raw_data) if EPG_URL.endswith(".gz") else raw_data

    root = ET.fromstring(xml_bytes)

    xml_to_our_key: dict[str, str] = {}
    for ch in root.findall("channel"):
        xml_id = ch.attrib.get("id", "")
        disp = ch.findtext("display-name") or ""
        matched_key = match_channel(xml_id, disp)
        if matched_key and matched_key not in xml_to_our_key.values():
            xml_to_our_key[xml_id] = matched_key

    now = datetime.now(BRUSSELS_TZ)
    window_start = now.replace(hour=window_start_hour, minute=0, second=0, microsecond=0)
    window_end = window_start + timedelta(hours=window_hours)

    channels_output = {
        key: {
            "id": cfg["id"],
            "name": cfg["name"],
            "category": cfg["category"],
            "app": cfg["app"],
            "deepLink": cfg["deepLink"],
            "programs": [],
        }
        for key, cfg in CHANNEL_CONFIG.items()
    }

    for prog in root.findall("programme"):
        xml_ch = prog.attrib.get("channel", "")
        our_key = xml_to_our_key.get(xml_ch)
        if not our_key:
            continue

        start_dt = parse_xmltv_time(prog.attrib["start"])
        stop_dt = parse_xmltv_time(prog.attrib["stop"])
        if stop_dt <= window_start or start_dt >= window_end:
            continue

        title = (prog.findtext("title") or "Geen titel").strip()
        desc = (prog.findtext("desc") or "Geen beschrijving beschikbaar.").strip()
        raw_cat = prog.findtext("category") or ""
        genre = infer_genre(raw_cat, title, desc, our_key)

        clamped_start = max(start_dt, window_start)
        clamped_stop = min(stop_dt, window_end)
        start_mins = int((clamped_start - window_start).total_seconds() // 60)
        duration_mins = max(15, int((clamped_stop - clamped_start).total_seconds() // 60))

        channels_output[our_key]["programs"].append({
            "title": title,
            "start": start_dt.strftime("%H:%M"),
            "end": stop_dt.strftime("%H:%M"),
            "startMins": start_mins,
            "durationMins": duration_mins,
            "genre": genre,
            "desc": desc[:320] + ("..." if len(desc) > 320 else ""),
        })

    final_list = []
    for key in CHANNEL_ORDER:
        ch_data = channels_output[key]
        ch_data["programs"].sort(key=lambda x: x["startMins"])
        final_list.append(ch_data)

    output = {
        "updatedAt": now.strftime("%Y-%m-%d %H:%M"),
        "windowStartHour": window_start_hour,
        "channels": final_list,
    }

    with open("guide.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    counts = ", ".join(f"{c['id']}:{len(c['programs'])}" for c in final_list)
    print(f"Klaar! guide.json gegenereerd voor {len(final_list)} zenders ({counts}).")


if __name__ == "__main__":
    build_guide()
