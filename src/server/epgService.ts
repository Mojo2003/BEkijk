import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import type {
  Channel,
  ChannelCategory,
  GuideResponse,
  LegacyGuideExport,
  Program,
  WindowMode,
} from '../types/epg.ts';

const EPG_URL = 'https://www.open-epg.com/files/belgium.xml.gz';
const BRUSSELS_TZ = 'Europe/Brussels';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface ChannelConfig {
  id: string;
  number: number;
  name: string;
  shortName: string;
  category: ChannelCategory;
  app: string;
  deepLink: string;
  accentColor: string;
  exactIds: string[];
  keywords: string[];
  excludeKeywords?: string[];
  legacyOrder?: number;
}

export const CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    id: 'vrt1',
    number: 1,
    name: 'VRT 1',
    shortName: 'VRT 1',
    category: 'vlaams',
    app: 'VRT MAX',
    deepLink: 'https://www.vrt.be/vrtmax/livestream/video/vrt1/',
    accentColor: '#00A8E8',
    exactIds: ['vrt1.be', 'een.be'],
    keywords: ['vrt 1', 'vrt1', 'een.be'],
    legacyOrder: 1,
  },
  {
    id: 'canvas',
    number: 2,
    name: 'VRT Canvas',
    shortName: 'CANVAS',
    category: 'vlaams',
    app: 'VRT MAX',
    deepLink: 'https://www.vrt.be/vrtmax/livestream/video/canvas/',
    accentColor: '#38BDF8',
    exactIds: ['canvas.be'],
    keywords: ['canvas', 'vrt canvas'],
    legacyOrder: 2,
  },
  {
    id: 'vtm',
    number: 3,
    name: 'VTM',
    shortName: 'VTM',
    category: 'vlaams',
    app: 'VTM GO',
    deepLink: 'https://www.vtmgo.be/vtmgo/live-kijken/vtm',
    accentColor: '#F59E0B',
    exactIds: ['vtm.be'],
    keywords: ['vtm.be', 'vtm hd', 'vtm'],
    excludeKeywords: ['vtm 2', 'vtm2', 'vtm 3', 'vtm3', 'vtm 4', 'vtm4', 'gold', 'series', 'xmas'],
    legacyOrder: 3,
  },
  {
    id: 'play4',
    number: 4,
    name: 'Play',
    shortName: 'PLAY',
    category: 'vlaams',
    app: 'GoPlay',
    deepLink: 'https://www.goplay.be/tv-gids',
    accentColor: '#10B981',
    exactIds: ['play.be', 'play4.be'],
    keywords: ['play.be', 'play4', 'play 4', 'vier'],
    excludeKeywords: ['fictie', 'actie', 'reality', 'crime', 'more', 'sports', 'playboy'],
    legacyOrder: 5,
  },
  {
    id: 'vtm2',
    number: 5,
    name: 'VTM 2',
    shortName: 'VTM 2',
    category: 'vlaams',
    app: 'VTM GO',
    deepLink: 'https://www.vtmgo.be/vtmgo/live-kijken/vtm2',
    accentColor: '#FB923C',
    exactIds: ['vtm2.be'],
    keywords: ['vtm 2', 'vtm2'],
    legacyOrder: 4,
  },
  {
    id: 'play5',
    number: 6,
    name: 'Play Fictie',
    shortName: 'PLAY FICTIE',
    category: 'vlaams',
    app: 'GoPlay',
    deepLink: 'https://www.goplay.be/tv-gids',
    accentColor: '#34D399',
    exactIds: ['playfictie.be', 'play5.be'],
    keywords: ['play fictie', 'playfictie', 'play5', 'play 5', 'vijf'],
    legacyOrder: 6,
  },
  {
    id: 'play6',
    number: 7,
    name: 'Play Actie',
    shortName: 'PLAY ACTIE',
    category: 'vlaams',
    app: 'GoPlay',
    deepLink: 'https://www.goplay.be/tv-gids',
    accentColor: '#2DD4BF',
    exactIds: ['playactie.be', 'play6.be'],
    keywords: ['play actie', 'playactie', 'play6', 'play 6', 'zes'],
  },
  {
    id: 'vtm3',
    number: 8,
    name: 'VTM 3',
    shortName: 'VTM 3',
    category: 'vlaams',
    app: 'VTM GO',
    deepLink: 'https://www.vtmgo.be/vtmgo/live-kijken/vtm3',
    accentColor: '#FBBF24',
    exactIds: ['vtm3.be'],
    keywords: ['vtm 3', 'vtm3'],
  },
  {
    id: 'vtm4',
    number: 9,
    name: 'VTM 4',
    shortName: 'VTM 4',
    category: 'vlaams',
    app: 'VTM GO',
    deepLink: 'https://www.vtmgo.be/vtmgo/live-kijken/vtm4',
    accentColor: '#D97706',
    exactIds: ['vtm4.be'],
    keywords: ['vtm 4', 'vtm4'],
  },
  {
    id: 'ketnet',
    number: 10,
    name: 'Ketnet',
    shortName: 'KETNET',
    category: 'vlaams',
    app: 'VRT MAX',
    deepLink: 'https://www.vrt.be/vrtmax/livestream/video/ketnet/',
    accentColor: '#F43F5E',
    exactIds: ['ketnet.be'],
    keywords: ['ketnet'],
  },
  {
    id: 'laune',
    number: 11,
    name: 'La Une',
    shortName: 'LA UNE',
    category: 'waals',
    app: 'RTBF Auvio',
    deepLink: 'https://auvio.rtbf.be/direct',
    accentColor: '#EF4444',
    exactIds: ['laune.be'],
    keywords: ['la une', 'laune'],
    legacyOrder: 7,
  },
  {
    id: 'tipik',
    number: 12,
    name: 'Tipik',
    shortName: 'TIPIK',
    category: 'waals',
    app: 'RTBF Auvio',
    deepLink: 'https://auvio.rtbf.be/direct',
    accentColor: '#EC4899',
    exactIds: ['tipik.be'],
    keywords: ['tipik'],
    excludeKeywords: ['vision', 'radio'],
  },
  {
    id: 'rtltvi',
    number: 13,
    name: 'RTL TVI',
    shortName: 'RTL TVI',
    category: 'waals',
    app: 'RTL play',
    deepLink: 'https://www.rtlplay.be/direct',
    accentColor: '#3B82F6',
    exactIds: ['rtltvi.be'],
    keywords: ['rtl tvi', 'rtltvi', 'rtl-tvi'],
    legacyOrder: 8,
  },
  {
    id: 'rtlclub',
    number: 14,
    name: 'RTL club',
    shortName: 'RTL CLUB',
    category: 'waals',
    app: 'RTL play',
    deepLink: 'https://www.rtlplay.be/direct',
    accentColor: '#60A5FA',
    exactIds: ['rtlclub.be'],
    keywords: ['rtl club', 'rtlclub'],
  },
  {
    id: 'arte',
    number: 15,
    name: 'ARTE',
    shortName: 'ARTE',
    category: 'waals',
    app: 'ARTE',
    deepLink: 'https://www.arte.tv/fr/direct/',
    accentColor: '#F97316',
    exactIds: ['artebelgique.be', 'arte.be'],
    keywords: ['arte'],
    legacyOrder: 9,
  },
  {
    id: 'npo1',
    number: 16,
    name: 'NPO 1',
    shortName: 'NPO 1',
    category: 'nl',
    app: 'NPO Start',
    deepLink: 'https://npo.nl/start/live?channel=NPO1',
    accentColor: '#FB7185',
    exactIds: ['npo1.be'],
    keywords: ['npo 1', 'npo1'],
  },
];

interface RawProgram {
  channelKey: string;
  title: string;
  startTs: number;
  endTs: number;
  genre: string;
  desc: string;
  episode?: string;
}

interface EpgCache {
  fetchedAt: number;
  source: 'live-xmltv' | 'seed-fallback';
  programsByChannel: Record<string, RawProgram[]>;
}

let memoryCache: EpgCache | null = null;
let inflightFetch: Promise<EpgCache> | null = null;

function extractText(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    for (const item of val) {
      const t = extractText(item);
      if (t) return t;
    }
    return '';
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if ('#text' in obj) return extractText(obj['#text']);
  }
  return '';
}

function parseXmltvTimestamp(raw: string | undefined): number | null {
  if (!raw) return null;
  const clean = raw.trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss, sign, offH, offM] = match;
  const baseUtc = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss)
  );
  if (sign && offH && offM) {
    const offsetMins = (sign === '+' ? 1 : -1) * (Number(offH) * 60 + Number(offM));
    return baseUtc - offsetMins * 60_000;
  }
  return baseUtc;
}

function getBrusselsDateParts(ts: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BRUSSELS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0');
  const hour = get('hour') === 24 ? 0 : get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
  };
}

function brusselsWallToUtc(year: number, month: number, day: number, hour: number, minute = 0): number {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i++) {
    const actual = getBrusselsDateParts(utc);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0);
    utc += desiredAsUtc - actualAsUtc;
  }
  return utc;
}

function formatBrusselsTime(ts: number): string {
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: BRUSSELS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}

function formatBrusselsDateTime(ts: number): string {
  const p = getBrusselsDateParts(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

function formatBrusselsDateLabel(ts: number, dayOffset: number): string {
  const formatted = new Intl.DateTimeFormat('nl-BE', {
    timeZone: BRUSSELS_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(ts));
  if (dayOffset === 0) return `Vandaag · ${formatted}`;
  if (dayOffset === 1) return `Morgen · ${formatted}`;
  if (dayOffset === -1) return `Gisteren · ${formatted}`;
  return formatted;
}

function inferGenre(rawCategory: string, title: string, desc: string, channelId: string): string {
  if (rawCategory && rawCategory.toLowerCase() !== 'tv' && rawCategory.toLowerCase() !== 'unknown') {
    return rawCategory;
  }
  const text = `${title} ${desc}`.toLowerCase();

  if (channelId === 'ketnet' || /\b(ketnet|karrewiet|kabouter|samson|maya|smurfen|kinderen)\b/.test(text)) {
    return 'Jeugd';
  }
  if (/\b(journaal|nws|nieuws|weerbericht|het weer|terzake|de afspraak|météo|journal|jt |info|aktuell|actua)\b/.test(text)) {
    return 'Nieuws & Actua';
  }
  if (/\b(sport|voetbal|wielrennen|koers|sporza|champions league|formule 1|grand prix|tennis|veldrijden|jupiler|pro league)\b/.test(text)) {
    return 'Sport';
  }
  if (/\b(film|movie|bioscoop|thriller|komedie|action|actiefilm|sciencefiction|romantische komedie|regie:|met o\.a\.)\b/.test(text)) {
    return 'Film';
  }
  if (/\b(documentaire|docu|panorama|pano|vranckx|reizen|natuur|geschiedenis|erfgoed|wetenschap|arte reportage)\b/.test(text)) {
    return 'Documentaire';
  }
  if (/\b(thuis|familie|serie|aflevering|seizoen|season|episode|politieserie|misdaadserie|drama)\b/.test(text)) {
    return 'Serie & Fictie';
  }
  if (/\b(blokken|slimste mens|komen eten|the voice|blind getrouwd|quiz|spelprogramma|show|muziek|concert|talkshow)\b/.test(text)) {
    return 'Entertainment';
  }
  return 'Programma';
}

function matchChannelConfig(xmlId: string, displayName: string): string | null {
  const idLower = xmlId.trim().toLowerCase();
  const combined = `${xmlId} ${displayName}`.toLowerCase();

  // Pass 1: exact xmltv id match
  for (const cfg of CHANNEL_CONFIGS) {
    if (cfg.exactIds.includes(idLower)) {
      return cfg.id;
    }
  }

  // Pass 2: keyword fallback with exclusion guard
  for (const cfg of CHANNEL_CONFIGS) {
    if (cfg.excludeKeywords?.some((ex) => combined.includes(ex))) {
      continue;
    }
    if (cfg.keywords.some((kw) => combined.includes(kw))) {
      return cfg.id;
    }
  }
  return null;
}

function loadSeedFallback(): EpgCache {
  const seedPath = path.resolve(process.cwd(), 'data/seed-guide.json');
  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as LegacyGuideExport;
  const programsByChannel: Record<string, RawProgram[]> = {};
  for (const cfg of CHANNEL_CONFIGS) {
    programsByChannel[cfg.id] = [];
  }

  const nowParts = getBrusselsDateParts(Date.now());
  const windowStartHour = raw.windowStartHour ?? 17;

  for (const ch of raw.channels || []) {
    if (!programsByChannel[ch.id]) continue;
    for (const p of ch.programs || []) {
      const startTs = brusselsWallToUtc(nowParts.year, nowParts.month, nowParts.day, windowStartHour, 0) + p.startMins * 60_000;
      const endTs = startTs + p.durationMins * 60_000;
      programsByChannel[ch.id].push({
        channelKey: ch.id,
        title: p.title,
        startTs,
        endTs,
        genre: inferGenre(p.genre, p.title, p.desc, ch.id),
        desc: p.desc,
      });
    }
  }

  return {
    fetchedAt: Date.now(),
    source: 'seed-fallback',
    programsByChannel,
  };
}

async function fetchLiveXmltv(): Promise<EpgCache> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(EPG_URL, {
      headers: { 'User-Agent': 'KijkBE-EPG/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from open-epg`);
    }

    const arrayBuf = await response.arrayBuffer();
    const rawBuf = Buffer.from(arrayBuf);
    const xmlStr = EPG_URL.endsWith('.gz')
      ? zlib.gunzipSync(rawBuf).toString('utf-8')
      : rawBuf.toString('utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      isArray: (name) => ['channel', 'programme', 'display-name', 'category', 'episode-num'].includes(name),
    });

    const parsed = parser.parse(xmlStr);
    const tv = parsed?.tv;
    if (!tv) {
      throw new Error('Invalid XMLTV root');
    }

    const xmlToChannelKey: Record<string, string> = {};
    const claimedKeys = new Set<string>();

    for (const ch of tv.channel || []) {
      const xmlId = String(ch['@_id'] || '');
      const disp = extractText(ch['display-name']);
      const matchedKey = matchChannelConfig(xmlId, disp);
      if (matchedKey && !claimedKeys.has(matchedKey)) {
        xmlToChannelKey[xmlId] = matchedKey;
        claimedKeys.add(matchedKey);
      }
    }

    const programsByChannel: Record<string, RawProgram[]> = {};
    for (const cfg of CHANNEL_CONFIGS) {
      programsByChannel[cfg.id] = [];
    }

    for (const prog of tv.programme || []) {
      const xmlCh = String(prog['@_channel'] || '');
      const channelKey = xmlToChannelKey[xmlCh];
      if (!channelKey) continue;

      const startTs = parseXmltvTimestamp(prog['@_start']);
      const endTs = parseXmltvTimestamp(prog['@_stop']);
      if (!startTs || !endTs || endTs <= startTs) continue;

      const title = extractText(prog.title) || 'Geen titel';
      const desc = extractText(prog.desc) || 'Geen beschrijving beschikbaar.';
      const rawCat = extractText(prog.category);
      const episode = extractText(prog['episode-num']) || undefined;

      programsByChannel[channelKey].push({
        channelKey,
        title,
        startTs,
        endTs,
        genre: inferGenre(rawCat, title, desc, channelKey),
        desc: desc.length > 320 ? `${desc.slice(0, 317)}...` : desc,
        episode,
      });
    }

    for (const key of Object.keys(programsByChannel)) {
      programsByChannel[key].sort((a, b) => a.startTs - b.startTs);
    }

    return {
      fetchedAt: Date.now(),
      source: 'live-xmltv',
      programsByChannel,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getEpgCache(forceRefresh = false): Promise<EpgCache> {
  if (!forceRefresh && memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache;
  }

  if (inflightFetch && !forceRefresh) {
    return inflightFetch;
  }

  inflightFetch = (async () => {
    try {
      const live = await fetchLiveXmltv();
      memoryCache = live;
      return live;
    } catch (err) {
      console.warn('[KijkBE] Live XMLTV fetch failed, using fallback:', err instanceof Error ? err.message : err);
      if (memoryCache) return memoryCache;
      const seed = loadSeedFallback();
      memoryCache = seed;
      return seed;
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

export async function buildGuideResponse(options: {
  dayOffset?: number;
  windowMode?: WindowMode;
  forceRefresh?: boolean;
}): Promise<GuideResponse> {
  const dayOffset = Math.max(-1, Math.min(2, options.dayOffset ?? 0));
  const windowMode: WindowMode = options.windowMode === 'primetime' ? 'primetime' : 'day';
  const cache = await getEpgCache(options.forceRefresh);

  const nowParts = getBrusselsDateParts(Date.now());
  const targetMidnightUtc = brusselsWallToUtc(nowParts.year, nowParts.month, nowParts.day + dayOffset, 0, 0);
  const targetParts = getBrusselsDateParts(targetMidnightUtc);

  const windowStartHour = windowMode === 'primetime' ? 17 : 6;
  const windowHours = windowMode === 'primetime' ? 9 : 20; // 17:00->02:00 or 06:00->02:00
  const windowEndHour = windowStartHour + windowHours;

  const windowStartTs = brusselsWallToUtc(
    targetParts.year,
    targetParts.month,
    targetParts.day,
    windowStartHour,
    0
  );
  const windowEndTs = windowStartTs + windowHours * 60 * 60 * 1000;

  const channels: Channel[] = CHANNEL_CONFIGS.map((cfg) => {
    const rawList = cache.programsByChannel[cfg.id] || [];
    const programs: Program[] = [];

    for (const raw of rawList) {
      if (raw.endTs <= windowStartTs || raw.startTs >= windowEndTs) continue;
      const clampedStart = Math.max(raw.startTs, windowStartTs);
      const clampedEnd = Math.min(raw.endTs, windowEndTs);
      const startMins = Math.max(0, Math.floor((clampedStart - windowStartTs) / 60_000));
      const actualDurationMins = Math.max(1, Math.round((raw.endTs - raw.startTs) / 60_000));
      const durationMins = Math.max(10, Math.round((clampedEnd - clampedStart) / 60_000));

      programs.push({
        id: `${cfg.id}-${raw.startTs}`,
        title: raw.title,
        start: formatBrusselsTime(raw.startTs),
        end: formatBrusselsTime(raw.endTs),
        startTs: raw.startTs,
        endTs: raw.endTs,
        startMins,
        durationMins,
        actualDurationMins,
        genre: raw.genre,
        desc: raw.desc,
        episode: raw.episode,
      });
    }

    return {
      id: cfg.id,
      number: cfg.number,
      name: cfg.name,
      shortName: cfg.shortName,
      category: cfg.category,
      app: cfg.app,
      deepLink: cfg.deepLink,
      accentColor: cfg.accentColor,
      programs,
    };
  });

  return {
    updatedAt: formatBrusselsDateTime(cache.fetchedAt),
    source: cache.source,
    timezone: BRUSSELS_TZ,
    windowMode,
    windowStartHour,
    windowEndHour,
    windowStartTs,
    windowEndTs,
    dateLabel: formatBrusselsDateLabel(windowStartTs, dayOffset),
    dayOffset,
    channels,
  };
}

export async function buildLegacyGuideExport(): Promise<LegacyGuideExport> {
  const guide = await buildGuideResponse({ dayOffset: 0, windowMode: 'primetime' });
  const legacyOrderIds = ['vrt1', 'canvas', 'vtm', 'vtm2', 'play4', 'play5', 'laune', 'rtltvi', 'arte'];
  const channels = legacyOrderIds
    .map((id) => guide.channels.find((c) => c.id === id))
    .filter((c): c is Channel => Boolean(c))
    .map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      app: c.app,
      deepLink: c.deepLink,
      programs: c.programs.map((p) => ({
        title: p.title,
        start: p.start,
        end: p.end,
        startMins: p.startMins,
        durationMins: Math.max(15, p.durationMins),
        genre: p.genre,
        desc: p.desc,
      })),
    }));

  return {
    updatedAt: guide.updatedAt,
    windowStartHour: 17,
    channels,
  };
}
